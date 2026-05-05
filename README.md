# Maietek

Privátní BDSM kontrolní a řídící aplikace pro uspořádání DOM/SUB.

> **Důležité pravidlo projektu**: Celá aplikace (jak uživatelské rozhraní, tak systémové texty) musí být výhradně v českém jazyce.

Pro podrobný návrh systému si přečtěte `docs/ARCHITECTURE.md`.
Produkční deploy checklist je v `docs/DEPLOYMENT.md`.

## Obnova hesla

Login obsahuje odkaz `Zapomenuté heslo?`. Reset flow používá Express API a Resend:

- `POST /api/auth/forgot-password` vygeneruje Supabase recovery link a odešle e-mail přes Resend.
- `/reset-password` nastaví nové heslo přes `POST /api/auth/reset-password`.
- Nové heslo se synchronizuje do Supabase Auth i do `user_vault`.

Potřebné env proměnné pro server:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SITE_URL` nebo `WEB_URL` pro správnou URL v reset odkazu

Secret hodnoty nepatří do dokumentace ani do logů.

## Chrome Extension MMM

Extension scaffold se builduje z `apps/chrome-extension`:

```bash
pnpm --filter chrome-extension build
```

Build vyžaduje explicitní API URL:

- `EXTENSION_API_BASE_URL`, například `https://maietek.maiweb.zip/api`, nebo
- `SITE_URL` / `NEXT_PUBLIC_APP_URL`, ze kterého build automaticky použije `/api`

Výstup je v `apps/chrome-extension/dist` a lze ho načíst v Chrome přes `chrome://extensions` jako unpacked extension. Párovací kód generuje DOM na stránce `/monitoring`.

## Task automation crony

Aplikace má připravené chráněné Next API routy pro automatiku úkolů:

- `/api/cron/tasks/expire` - expiruje prošlé úkoly a volitelně připíše kázeňský dluh.
- `/api/cron/tasks/recurring` - generuje denní/týdenní/měsíční instance opakovaných úkolů.
- `/api/cron/monitoring/cleanup` - maže monitoring události starší než 3 měsíce.

Cron routy vyžadují `CRON_SECRET`. V produkčním prostředí musí být nastavené:

- `CRON_SECRET`
- `SUPABASE_SERVICE_KEY` nebo `SUPABASE_SERVICE_ROLE_KEY`
- produkční URL aplikace, například přes `SITE_URL` nebo `TASK_CRON_BASE_URL`

Secret hodnoty nepatří do dokumentace ani do crontabu.

### VPS/system cron

Pro vlastní server je připravený runner:

```bash
node scripts/run-task-cron.mjs expire
node scripts/run-task-cron.mjs recurring
node scripts/run-task-cron.mjs monitoring-cleanup
```

Runner si načte `CRON_SECRET` z env souborů a secret nevkládá přímo do příkazu.

Příklad crontabu:

```cron
* * * * * cd /cesta/k/projektu && mkdir -p logs && node scripts/run-task-cron.mjs expire >> logs/task-cron.log 2>&1
5 0 * * * cd /cesta/k/projektu && mkdir -p logs && node scripts/run-task-cron.mjs recurring >> logs/task-cron.log 2>&1
30 2 * * * cd /cesta/k/projektu && mkdir -p logs && node scripts/run-task-cron.mjs monitoring-cleanup >> logs/task-cron.log 2>&1
```

Pro produkční doménu nastav:

```bash
TASK_CRON_BASE_URL=https://tvoje-domena.cz
```
