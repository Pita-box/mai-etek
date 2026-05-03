# Plan: Zapomenuté heslo přes Resend

## Goal
Přidat kompletní password reset flow:
- odkaz `Zapomenuté heslo?` na loginu,
- stránku `/forgot-password`,
- reset e-mail přes Resend,
- stránku `/reset-password`,
- bezpečné nastavení nového hesla přes Express server,
- synchronizaci `user_vault`.

## Assumptions
- Reset e-mail bude posílat Express server, ne Next API route, protože Express už má encryption helper pro `user_vault`.
- Supabase Auth recovery link se vygeneruje přes service role `generateLink`.
- `EMAIL_FROM` a `RESEND_API_KEY` budou dostupné serveru v runtime.
- Produkční web URL se vezme z `SITE_URL`, `WEB_URL` nebo fallback `http://localhost:3000`.

## Plan
1. Přidat Resend e-mail helper do serveru
   - File: `apps/server/src/services/email.ts` nebo podobný.
   - Použít `fetch` proti Resend API, bez nové dependency.
   - Načítat:
     - `RESEND_API_KEY`
     - `EMAIL_FROM`
   - Přidat timeout přes `AbortController`.
   - Verify:
     - TypeScript build serveru.

2. Přidat auth reset controller/server routes
   - Files:
     - `apps/server/src/controllers/auth/index.ts`
     - případně `apps/server/src/routes/auth.ts`
   - `POST /api/auth/forgot-password`
     - vstup: `{ email }`
     - validace přes `zod`
     - zavolat Supabase Admin `generateLink({ type: "recovery", email, options: { redirectTo } })`
     - pokud e-mail neexistuje nebo Supabase vrátí bezpečně očekávanou chybu, vrátit stejnou generickou success hlášku
     - pokud link existuje, poslat e-mail přes Resend
     - nelogovat link ani secret
   - `POST /api/auth/reset-password`
     - vyžaduje `Authorization: Bearer <recovery access token>`
     - vstup: `{ password }`
     - ověří token přes `supabaseAdmin.auth.getUser(token)`
     - změní heslo přes `supabaseAdmin.auth.admin.updateUserById(user.id, { password })`
     - aktualizuje/insertne `user_vault.encrypted_password`
     - volitelně pošle existující security Telegram notification pro non-DOM uživatele podle současné logiky
   - Verify:
     - server tsc/build.

3. Přidat `/forgot-password` stránku
   - File: `apps/web/src/app/(auth)/forgot-password/page.tsx`
   - Form:
     - e-mail input
     - submit na `POST /api/auth/forgot-password` přes `NEXT_PUBLIC_API_URL`
     - po submitu vždy zobrazit generickou hlášku: pokud účet existuje, e-mail dorazí
   - Link zpět na login.
   - UI style sladit s login/register.
   - Verify:
     - web tsc/lint.

4. Přidat `/reset-password` stránku
   - File: `apps/web/src/app/(auth)/reset-password/page.tsx`
   - Client component:
     - vytvoří Supabase client
     - počká na recovery session/getSession
     - form `password`, `confirmPassword`
     - po submitu zavolá `/api/auth/reset-password` s access tokenem
     - po úspěchu odhlásí uživatele a přesměruje na `/login`
   - Chybové stavy:
     - neplatný/expirující link
     - hesla se neshodují
     - příliš krátké heslo
   - Verify:
     - web tsc/lint.

5. Upravit login UI
   - File: `apps/web/src/app/(auth)/login/page.tsx`
   - Přidat odkaz `Zapomenuté heslo?` poblíž password fieldu nebo pod formulářem.
   - Zachovat existující vzhled.
   - Přeložit validační texty loginu do češtiny, pokud se souboru budeme dotýkat.
   - Verify:
     - targeted lint.

6. Dokumentace a artifacts
   - Update:
     - `README.md` krátce zmínit `RESEND_API_KEY`, `EMAIL_FROM`, password reset flow.
     - `docs/ARCHITECTURE.md` zaznamenat stav Auth / Password reset.
     - `artifacts/superpowers/finish.md` po implementaci.
   - Verify:
     - `git diff --check`.

7. Ověření
   - Commands:
     - `pnpm --filter server build`
     - `pnpm --filter web exec tsc --noEmit`
     - targeted ESLint pro upravené web soubory
     - `git diff --check -- <upravené soubory>`
   - Manual smoke:
     - otevřít `/login`, kliknout `Zapomenuté heslo?`
     - zadat existující e-mail
     - ověřit doručení Resend e-mailu
     - otevřít link a nastavit nové heslo
     - ověřit login novým heslem
     - ověřit, že staré heslo nefunguje
     - ověřit, že SuperAdmin reveal používá nové heslo z `user_vault`

## Risks & Mitigations
- Account enumeration.
  - Vždy vracet generickou success hlášku pro forgot-password.
- Nesynchronizovaný `user_vault`.
  - Nové heslo nastavovat přes Express reset route, ne přímo přes Supabase client.
- E-mail link leak v logu.
  - Nelogovat `action_link`.
- Resend config missing.
  - Server log + bezpečná chyba; UI nevypíše secrets.
- Recovery session handling.
  - Reset page musí čekat na Supabase session a zobrazit jasnou chybu pro neplatný/expirující link.

## Success Criteria
- Uživatel vidí `Zapomenuté heslo?` na loginu.
- Reset e-mail se odesílá přes Resend.
- Reset link vede na webovou stránku pro nové heslo.
- Nové heslo se uloží v Supabase Auth i `user_vault`.
- Žádné secrets ani reset linky nejsou vypsané v UI/logu/artefaktech.
