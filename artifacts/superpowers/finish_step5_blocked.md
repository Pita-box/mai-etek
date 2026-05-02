## Stav
Step 5 implementace Chat page byla dokončena na úrovni kódu a prošla TypeScript ověřením, ale browser verifikace se zablokovala interní chybou browser tooling.

## Hotové změny
- `apps/web/src/components/chat/ChatPageClient.tsx`
- `apps/web/src/app/(dashboard)/chat/page.tsx`
- Chat page je nyní napojená na `getChatMessages` a `sendChatMessage`.

## Verifikace
### Prošlo
```bash
pnpm --filter web exec tsc --noEmit
```

### Nešlo ověřit v browseru
Browser subagent selhal při otevření `/chat` na interní Playwright chybě:
- `Protocol error (Browser.setDownloadBehavior): Browser context management is not supported.`

Pokusy:
- `http://localhost:3000/chat`
- `http://localhost:3001/chat`

Poslední známý browser stav byl `http://localhost:3000/login`, ale kvůli chybě nástroje nešlo potvrdit finální render `/chat`.

## Review pass
- **Blocker:** Browser tooling chyba znemožnila povinné live ověření `/chat`.
- **Major:** Nemám důkaz screenshotem, že se page renderuje v běžící appce.
- **Minor:** Lint baseline repozitáře stále obsahuje nesouvisející chyby mimo chat scope.
- **Nit:** Browser flow může navíc vyžadovat přihlášení, ale kvůli tool failure to nešlo potvrdit.

## Potřebuji rozhodnutí
Jak chce uživatel pokračovat:
1. zkusit browser ověření znovu později,
2. pokračovat bez browser verifikace jen na základě TS kontroly,
3. nechat uživatele ručně otevřít `/chat` a poslat výsledek/screenshot.

