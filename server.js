// Тимур-Бей — онлайн-сервер (Node.js 18+). Роздає гру і з'єднує гравців у кімнати через WebSocket.
// Запуск: npm install && npm start  → відкрий http://localhost:3000
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const GAME = path.join(__dirname, 'public', 'index.html');
const MAX_PLAYERS = 12;          // гравців в одній кімнаті; якщо більше — сервер сам відкриває наступну
const SEED = 20261029;            // одне місто для всіх
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (req.url === '/' || req.url.startsWith('/?') || req.url === '/index.html') {
    fs.readFile(GAME, (err, data) => {
      if (err) { res.writeHead(500); res.end('Немає файлу public/index.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  // файли для iPhone/Android «на головний екран»: іконки, маніфест, service worker
  const STATIC = { '/manifest.webmanifest': 'application/manifest+json', '/sw.js': 'text/javascript; charset=utf-8',
    '/icon-192.png': 'image/png', '/icon-512.png': 'image/png', '/apple-touch-icon.png': 'image/png' };
  const url = req.url.split('?')[0];
  if (STATIC[url]) {
    fs.readFile(path.join(__dirname, 'public', url.slice(1)), (err, data) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': STATIC[url], 'Cache-Control': url === '/sw.js' ? 'no-cache' : 'public, max-age=86400' });
      res.end(data);
    });
    return;
  }
  res.writeHead(404); res.end('404');
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map();   // код кімнати -> { code, seed, host, players: Map, blocks: [] }
let nextId = 1;

const clean = s => String(s || 'Гравець').replace(/[<>]/g, '').slice(0, 14) || 'Гравець';
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
function broadcast(room, o, except) {
  const s = JSON.stringify(o);
  for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s);
}
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); } while (rooms.has(c));
  return c;
}
function scoreOf(room) { return [...room.players.values()].map(p => ({ id: p.id, name: p.name, k: p.kills })); }
function sendScore(room) { broadcast(room, { t: 'score', list: scoreOf(room) }); }
// спільні кімнати: «Кімната 1», «Кімната 2»… — гравець нічого не обирає
function publicRoom() {
  for (let n = 1; ; n++) {
    const code = 'R' + n;
    let r = rooms.get(code);
    if (!r) { r = { code, n, pub: true, seed: SEED, host: 'Тимур-Бей', players: new Map(), blocks: [] }; rooms.set(code, r); }
    if (r.players.size < MAX_PLAYERS) return r;
  }
}
const roomList = () => [...rooms.values()].filter(r => r.players.size < MAX_PLAYERS)
  .map(r => ({ code: r.code, n: r.players.size, host: r.host }));

wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  const me = { id: 'p' + (nextId++), ws, room: null, name: 'Гравець', look: {}, coins: 50, kills: 0, s: null, msgs: 0 };
  ws.me = me;
  send(ws, { t: 'rooms', list: roomList() });

  ws.on('message', buf => {
    if (++me.msgs > 400) return;                     // захист від спаму (скидається щосекунди)
    let m; try { m = JSON.parse(buf); } catch (e) { return; }
    if (m.t === 'list') { send(ws, { t: 'rooms', list: roomList() }); return; }

    if (m.t === 'quick' || m.t === 'create' || m.t === 'join') {
      if (me.room) return;
      let room;
      if (m.t === 'quick') room = publicRoom();
      else if (m.t === 'create') {
        room = { code: newCode(), seed: Number.isFinite(m.seed) ? (m.seed | 0) : 20261029, host: clean(m.name), players: new Map(), blocks: [] };
        rooms.set(room.code, room);
      } else {
        room = rooms.get(String(m.room || '').toUpperCase());
        if (!room) { send(ws, { t: 'err', msg: 'Кімнату не знайдено — перевір код' }); return; }
        if (room.players.size >= MAX_PLAYERS) { send(ws, { t: 'err', msg: 'Кімната заповнена' }); return; }
      }
      me.name = clean(m.name); me.look = (m.look && typeof m.look === 'object') ? m.look : {}; me.room = room;
      if (Number.isFinite(+m.coins) && m.coins !== undefined) me.coins = Math.max(0, Math.min(1000000, Math.floor(+m.coins)));
      if (Number.isFinite(+m.kills) && m.kills !== undefined) me.kills = Math.max(0, Math.min(100000, Math.floor(+m.kills)));   // повернення після обриву зв'язку
      room.players.set(me.id, me);
      send(ws, { t: 'joined', room: room.code, n: room.n || 0, id: me.id, seed: room.seed, coins: me.coins, blocks: room.blocks.slice(-3000),
        players: [...room.players.values()].filter(p => p !== me).map(p => ({ id: p.id, name: p.name, look: p.look })) });
      broadcast(room, { t: 'join', id: me.id, name: me.name, look: me.look }, ws);
      sendScore(room);
      console.log(`${me.name} -> кімната ${room.code} (${room.players.size})`);
      return;
    }

    const room = me.room; if (!room) return;
    switch (m.t) {
      case 's':     // стан гравця 10 разів на секунду
        me.s = m.p;
        broadcast(room, { t: 's', id: me.id, p: m.p, v: m.v, vid: m.vid, w: m.w, a: m.a, hp: m.hp }, ws); break;
      case 'shot':
        broadcast(room, { t: 'shot', id: me.id, o: m.o, d: m.d, w: m.w }, ws); break;
      case 'boom':
        broadcast(room, { t: 'boom', x: m.x, y: m.y, z: m.z, r: m.r, c: m.c }, ws); break;
      case 'hit': {  // влучання: пересилаємо тільки тому, в кого влучили
        const to = room.players.get(m.to); const dmg = Math.max(0, Math.min(20000, +m.dmg || 0));
        if (to) send(to.ws, { t: 'hit', from: me.id, dmg }); break;
      }
      case 'die': {  // переможений віддає половину монет переможцю + 25 за перемогу
        const lost = Math.max(0, Math.min(me.coins, Math.floor(+m.lost || 0)));
        me.coins -= lost; send(ws, { t: 'bal', coins: me.coins });
        const k = room.players.get(m.by);
        if (k && k !== me) { const n = 25 + lost; k.coins += n; k.kills++; send(k.ws, { t: 'reward', n, name: me.name }); send(k.ws, { t: 'bal', coins: k.coins }); }
        broadcast(room, { t: 'die', id: me.id, by: k ? k.id : null }, ws); sendScore(room); break;
      }
      case 'coins': {  // сервер — "банк гри": тримає справжній баланс
        const d = Math.round(+m.d || 0);
        if (d > 0 && d <= 1000) me.coins += d; else if (d < 0 && me.coins + d >= 0) me.coins += d;
        send(ws, { t: 'bal', coins: me.coins }); break;
      }
      case 'block': {
        const b = { b: String(m.b), x: m.x | 0, z: m.z | 0, y: +m.y || 0 };
        room.blocks.push(['a', b]); if (room.blocks.length > 6000) room.blocks.splice(0, 1000);
        broadcast(room, Object.assign({ t: 'block' }, b), ws); break;
      }
      case 'bdel': {
        const b = { x: m.x | 0, z: m.z | 0, y: +m.y || 0 };
        room.blocks.push(['d', b]); broadcast(room, Object.assign({ t: 'bdel' }, b), ws); break;
      }
    }
  });

  ws.on('close', () => {
    const r = me.room; if (!r) return;
    r.players.delete(me.id); broadcast(r, { t: 'leave', id: me.id }); sendScore(r);
    if (!r.players.size && !r.pub) rooms.delete(r.code);   // спільні кімнати лишаються разом із побудованим
  });
});

setInterval(() => {   // відключаємо "мертві" з'єднання і скидаємо лічильник повідомлень
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
}, 15000);
setInterval(() => { for (const ws of wss.clients) if (ws.me) ws.me.msgs = 0; }, 1000);

server.listen(PORT, () => console.log('Тимур-Бей сервер працює на порту ' + PORT));
