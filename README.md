# Maietek

Email: dom@example.com
Heslo: SuperSecretPassword123!

Privátní BDSM kontrolní a řídící aplikace pro uspořádání DOM/SUB.

> **Důležité pravidlo projektu**: Celá aplikace (jak uživatelské rozhraní, tak systémové texty) musí být výhradně v českém jazyce.

Pro podrobný návrh systému si přečtěte `docs/ARCHITECTURE.md`.

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

## Task automation crony

Aplikace má připravené chráněné Next API routy pro automatiku úkolů:

- `/api/cron/tasks/expire` - expiruje prošlé úkoly a volitelně připíše kázeňský dluh.
- `/api/cron/tasks/recurring` - generuje denní/týdenní/měsíční instance opakovaných úkolů.

Obě routy vyžadují `CRON_SECRET`. V produkčním prostředí musí být nastavené:

- `CRON_SECRET`
- `SUPABASE_SERVICE_KEY` nebo `SUPABASE_SERVICE_ROLE_KEY`
- produkční URL aplikace, například přes `SITE_URL` nebo `TASK_CRON_BASE_URL`

Secret hodnoty nepatří do dokumentace ani do crontabu.

### Vercel Cron Jobs

Vercel umí cron jobs pro Vercel Functions přes `vercel.json`. Soubor dej do rootu Vercel projektu. Pokud je Vercel projekt nastavený s root directory `apps/web`, patří `vercel.json` do `apps/web`. Pokud Vercel builduje z rootu repozitáře, patří do rootu repozitáře.

Příklad:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/tasks/expire",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/tasks/recurring",
      "schedule": "5 23 * * *"
    }
  ]
}
```

Poznámky:

- Vercel cron jobs volají produkční deployment přes HTTP `GET`.
- Vercel cron výrazy jsou v UTC. `5 23 * * *` znamená 23:05 UTC, což je po půlnoci v Praze v zimním i letním čase.
- Pokud je v projektu nastavený `CRON_SECRET`, Vercel ho automaticky pošle jako `Authorization: Bearer <CRON_SECRET>`.
- Časté spouštění, například každou minutu pro `expire`, závisí na Vercel plánu. Pokud plán nepovolí minutely cron, použij VPS/system cron nebo externí scheduler.
- Po změně `vercel.json` nebo env variables je potřeba redeploy.

### VPS/system cron

Pro vlastní server je připravený runner:

```bash
node scripts/run-task-cron.mjs expire
node scripts/run-task-cron.mjs recurring
```

Runner si načte `CRON_SECRET` z env souborů a secret nevkládá přímo do příkazu.

Příklad crontabu:

```cron
* * * * * cd /cesta/k/projektu && mkdir -p logs && node scripts/run-task-cron.mjs expire >> logs/task-cron.log 2>&1
5 0 * * * cd /cesta/k/projektu && mkdir -p logs && node scripts/run-task-cron.mjs recurring >> logs/task-cron.log 2>&1
```

Pro produkční doménu nastav:

```bash
TASK_CRON_BASE_URL=https://tvoje-domena.cz
```
