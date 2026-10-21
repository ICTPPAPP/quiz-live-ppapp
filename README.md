# QUIZ LIVE PPAPP — Starter Pack

Pakej ini mengandungi:
- `index.html` — halaman utama / peserta
- `admin.html` — panel pentadbir prototaip
- `style.css` — reka bentuk responsif gelap ungu/biru
- `app.js` — interaksi frontend dan panggilan API awal
- `Code.gs` — backend Google Apps Script starter yang menggunakan tab Google Sheets sedia ada

## Penting sebelum guna
Ini starter/prototaip, bukan sistem produksi. Ia belum mempunyai aliran penuh host live, kawalan masa nyata, leaderboard, dan keselamatan pentadbir yang lengkap. Jangan guna dengan data sulit atau acara rasmi sebelum diuji dan dikukuhkan.

Apps Script ContentService mengalihkan respons ke URL lain; panggilan cross-origin dari GitHub Pages boleh menghadapi isu CORS. Jika berlaku, jangan cuba menyahaktifkan keselamatan pelayar. Kita perlu ubah kaedah sambungan atau letak frontend pada Apps Script HTML Service. Dokumentasi Google: https://developers.google.com/apps-script/guides/content

## Cara pasang GitHub Pages
1. Extract ZIP ini.
2. Dalam repository `quiz-live-ppapp`, klik **Add file → Upload files**.
3. Upload `index.html`, `admin.html`, `style.css`, `app.js`, dan `Code.gs` tidak perlu dimasukkan ke root GitHub (simpan untuk Apps Script). Boleh upload `README.md` juga.
4. Untuk Apps Script, buka `Code.gs` dalam projek Apps Script dan ganti dengan kandungan fail `Code.gs` daripada pakej ini.
5. Commit changes.
6. Repository → **Settings → Pages** → Deploy from a branch → `main` → `/(root)` → Save.
7. Tunggu URL Pages muncul. Buka URL itu untuk melihat UI.

## Apps Script
1. Pastikan Google Sheet mempunyai tab `Quizzes`, `Questions`, `Sessions`, `Players`, `Answers`, `Results` dengan header yang sudah disediakan sebelum ini.
2. Buka Apps Script yang terikat pada Google Sheet.
3. Salin kandungan `Code.gs` ke fail Apps Script.
4. Save, kemudian Deploy → Manage deployments → Edit → New version → Deploy.
5. Uji URL `/exec` dalam browser.

## Nota tentang API
Frontend ini cuba membuat `POST` dengan body JSON untuk `join` dan `createQuiz`. Disebabkan batasan CORS / redirect Google Apps Script, integrasi mungkin perlu disesuaikan selepas ujian sebenar. Admin authentication, create session UI, question editor, game loop dan leaderboard belum siap dalam versi starter ini.
