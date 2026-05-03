# Finish: Zapomenuté heslo přes Resend

## Hotovo
- Přidaný Resend e-mail helper na serveru bez nové dependency.
- Přidané Express endpointy:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- Reset hesla aktualizuje Supabase Auth i `user_vault.encrypted_password`.
- DOM účty zůstávají chráněné před security Telegram notifikací podle existující logiky.
- Přidané web stránky:
  - `/forgot-password`
  - `/reset-password`
- Login obsahuje odkaz `Zapomenuté heslo?` a české validační texty.
- `README.md` a `docs/ARCHITECTURE.md` popisují aktuální stav password reset flow.

## Ověření
- `pnpm --filter server build` -> prošlo.
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint 'src/app/(auth)/login/page.tsx' 'src/app/(auth)/forgot-password/page.tsx' 'src/app/(auth)/reset-password/page.tsx'` -> prošlo.
- `git diff --check -- README.md docs/ARCHITECTURE.md artifacts/superpowers/finish.md apps/server/src/utils/env.ts apps/server/src/services/email.ts apps/server/src/controllers/auth/index.ts apps/server/src/routes/auth.ts 'apps/web/src/app/(auth)/login/page.tsx' 'apps/web/src/app/(auth)/forgot-password/page.tsx' 'apps/web/src/app/(auth)/reset-password/page.tsx'` -> prošlo.
- `git diff --check -- apps/server/dist/controllers/auth/index.js apps/server/dist/routes/auth.js` -> prošlo.
- `rg -n "[[:blank:]]$" <upravené source/doc soubory>` -> bez nálezů.

## Manual smoke
- Otevřít `/login`.
- Kliknout `Zapomenuté heslo?`.
- Zadat existující e-mail.
- Ověřit doručení reset e-mailu.
- Otevřít reset link, nastavit nové heslo.
- Ověřit login novým heslem a ověřit, že SuperAdmin reveal používá nové heslo z `user_vault`.

---

# Finish: NEXT_PUBLIC_API_URL bez localhost fallbacků

## Hotovo
- Přidaný společný helper `apps/web/src/lib/api-url.ts`.
- Register, forgot-password, reset-password, `fetchApi`, chat actions a Socket.IO používají `NEXT_PUBLIC_API_URL`.
- Odstraněné fallbacky na `http://localhost:4000` z webového source kódu.
- Telegram odkazy už nepadají na `http://localhost:3000`; bez web URL použijí relativní cestu.
- Server Socket.IO CORS a serverové Telegram odkazy už nemají localhost fallback.
- Cron runner už vyžaduje reálnou base URL přes env, místo aby padal na localhost.

## Ověření
- `rg -n "localhost:4000|http://localhost" apps/web/src apps/web -g '*.ts' -g '*.tsx' -g '*.js' -g '*.mjs' -g '*.json'` -> bez nálezů.
- `rg -n "http://localhost|localhost:4000" apps packages scripts --glob '!**/dist/**' --glob '!**/.next/**' --glob '!**/node_modules/**'` -> zůstává jen dokumentační odkaz v `apps/web/README.md`.
- `pnpm --filter server build` -> prošlo.
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint 'src/app/(auth)/register/page.tsx' 'src/app/(auth)/forgot-password/page.tsx' 'src/app/(auth)/reset-password/page.tsx' 'src/lib/api-url.ts' 'src/lib/api-client.ts' 'src/lib/socket.ts' 'src/actions/chat.ts' 'src/lib/telegram/notifications.ts'` -> prošlo.
- `git diff --check -- <upravené web soubory>` -> prošlo.
