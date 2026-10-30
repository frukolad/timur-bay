# Тимур-Бей — онлайн-сервер

1. Встанови Node.js 18+ (nodejs.org).
2. У цій папці: `npm install`, потім `npm start` (у PowerShell: `npm.cmd install`, `npm.cmd start`).
3. Відкрий http://localhost:3000 — це гра. У меню: «ОНЛАЙН З ДРУЗЯМИ» → «ГРАТИ ОНЛАЙН». Усі потрапляють в одне спільне місто (до 12 гравців; якщо більше — сервер сам відкриває кімнату 2).
4. Друзі в тій самій Wi-Fi мережі відкривають http://IP-ТВОГО-ПК:3000.
5. Для гри через інтернет — розгорни на Render.com (Web Service, Build: `npm install`, Start: `npm start`). Адреса за замовчуванням у грі й APK: wss://timur-bay.onrender.com.

Оновити гру: заміни public/index.html новою версією на GitHub — Render оновиться сам.

## iPhone / iPad
- Через Safari: відкрий адресу сервера → «Поділитися» → «На початковий екран».
- Застосунок (.ipa): папки `ios/` і `.github/` збирають його на Mac від GitHub (вкладка Actions → «iOS build»). Встановлення з Windows — через Sideloadly з власним Apple ID.
