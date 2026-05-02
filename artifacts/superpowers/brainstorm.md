# Brainstorm: Task expiry worker + recurring task generator

## Cíl
Dokončit zbývající část Phase 3 gamification/task automation:
- automaticky označovat prošlé úkoly jako `expired`,
- navázat na `discipline_points`/ledger přes připravený `task_expiry_penalty`,
- generovat nové instance opakovaných úkolů podle `recurrence`,
- zachovat auditovatelnost, idempotenci a notifikace/badges.

## Současný stav
- `tasks.deadline` existuje a UI ho nastavuje jako ISO datetime.
- `tasks.recurrence` existuje (`none`, `daily`, `weekly`, `monthly`) a UI ho ukládá.
- `tasks.status` podporuje `expired` přes migraci `20260426033700_tasks_workflow_tables.sql`.
- Gamification má připravený ledger source type `task_expiry_penalty` v `xp_transactions`.
- `user_stats` má `tasks_failed`, `current_streak` a `discipline_points`.
- `createActivityNotification(...)` už umí task badges pro DOM/SUB.
- Není vidět implementovaný worker/cron proces pro task expiry nebo recurring generation.
- `recurrence_config` je ve starším architektonickém návrhu, ale aktuální server action ho zatím nezapisuje.

## Doporučený MVP rozsah
### 1. Expiry worker jako databázová RPC + server runner
Nejdřív udělat DB/RPC idempotentní jádro, pak způsob spouštění.

- RPC: `public.expire_due_tasks(run_limit integer default 100)`
- Najde úkoly:
  - `deadline IS NOT NULL`
  - `deadline < now()`
  - status v aktivních stavech: `pending`, `in_progress`, případně `revision_requested`
  - pravděpodobně NE `in_review`, protože SUB už úkol odevzdal a čeká na DOM.
- Pro každý úkol:
  - row lock / `FOR UPDATE SKIP LOCKED`,
  - nastaví `status = 'expired'`,
  - zvýší `user_stats.tasks_failed += 1`,
  - vynuluje `current_streak = 0`,
  - volitelně přidá `discipline_points` přes `apply_manual_discipline(..., 'task_expiry_penalty', task.id)`,
  - vytvoří task notification pro SUB a DOM.
- Idempotence:
  - úkol se expiruje jen pokud status stále aktivní,
  - ledger pro konkrétní task expiry by měl být unikátní nebo kontrolovaný, aby se penalizace nepřidala dvakrát.

### 2. Spouštění expiry workeru
Možnosti:
- Next.js API route `/api/cron/tasks/expire` chráněná `CRON_SECRET`.
- Express/server cron interval každých 60s.
- Supabase pg_cron, pokud je dostupné.

Doporučení pro aktuální app: Next API route + lokální/serverový cron je nejméně invazivní. DB RPC drží bezpečnou logiku, route jen volá RPC.

### 3. Recurring task generator MVP
Současné UI umí jen `recurrence`, ne detailní `recurrence_config`. MVP může začít jednoduše:
- `daily`: každý den vytvořit jednu novou instanci.
- `weekly`: jednou týdně ve stejný den v týdnu jako template deadline/created_at.
- `monthly`: jednou měsíčně ve stejný den v měsíci jako template deadline/created_at.

Potřebujeme rozlišit template vs instance:
- Použít existující `parent_task_id` podle starší architektury, pokud sloupec v aktuální DB chybí, přidat migrací.
- Template: `recurrence != 'none' AND parent_task_id IS NULL`.
- Instance: `parent_task_id = template.id` a `recurrence = 'none'`.

Idempotence:
- přidat `recurrence_instance_date DATE`, nebo použít unikátní index `(parent_task_id, recurrence_instance_date)`.
- Bez samostatného `recurrence_instance_date` je detekce podle `created_at::date` méně přesná a hůř auditovatelná.

### 4. Deadline pro nové recurring instance
Možné chování:
- Zachovat čas z template deadline a posunout datum podle instance date.
- Pokud template nemá deadline, instance bude bez deadline.
- Pokud template má deadline v minulosti, brát pouze čas/délku vůči dni instance.

Doporučení:
- Pro MVP: recurring template musí mít deadline, aby generator věděl čas splnění.
- Denní instance: deadline = dnešní datum + čas z template deadline.
- Weekly/monthly: deadline = instance date + čas z template deadline.

### 5. UI změny pro opakování
Aktuální UI má jednoduchý select `none/daily/weekly/monthly`.
Pro MVP stačí:
- vysvětlit, že opakování používá čas z deadline,
- možná varovat, že recurring úkol bez deadline se nebude generovat nebo bude bez termínu.

Pozdější verze:
- `recurrence_config` UI: dny v týdnu, den v měsíci, čas, expiry penalty body.

### 6. Penalizace za expired task
Otázka: má být automaticky vždy, nebo per-task nastavení?
Možnosti:
- Globální default, např. žádná automatická penalizace dokud DOM nezadá hodnotu.
- Per-task `expiry_penalty_points` + `expiry_penalty_reason`.
- Odvodit z priority: low 5, medium 10, high 20, urgent 30.

Doporučení:
- Neautomatizovat tvrdé dluhy bez DOM kontroly.
- Přidat per-task volitelné pole `expiry_penalty_points`, default `0`.
- Pokud `0`, expiry jen označí úkol a vytvoří badge/notifikaci.
- Pokud > 0, worker přidá `discipline_points` s důvodem `Prošlý úkol: <title>`.

### 7. Notifikace a badges
- SUB dostane task badge: `Úkol prošel`.
- DOM dostane task badge: `SUB nesplnil úkol včas`.
- Pokud bude Telegram pro task expiry později žádoucí, napojit přes sjednocený notification service. Pro MVP stačí in-app badges.

## Rizika
- Duplicitní expirace nebo duplicitní recurring instance.
  - Řešit DB-level idempotencí a unique indexem.
- Nejasný stav `in_review`.
  - Doporučení: neexpiruje, protože SUB už splnil část workflow a čeká na DOM.
- Timezone.
  - Deadline je timestamptz, worker porovnává vůči `now()`; recurring instance date by měla používat Europe/Prague lokální datum.
- Existing schema drift.
  - Ověřit reálnou DB, zda `parent_task_id`/`recurrence_config` existuje v linked Supabase, protože starý SQL návrh je v `database/migrations`, ale aktuální Supabase migrace nemusely přidat vše.
- Worker deployment.
  - Pokud poběží jen v Next API route bez cron spouštěče, automatika nebude skutečně automatická. Potřebujeme buď server cron, nebo externí scheduler.

## Otevřené otázky pro rozhodnutí
1. Které stavy mají expirovat?
   - Doporučení: `pending`, `in_progress`, `revision_requested`; ne `in_review`.
2. Má prošlý úkol automaticky přidávat kázeňský dluh?
   - Doporučení: jen pokud DOM nastaví per-task penalty body; default `0`.
3. Má recurring template zůstat viditelný v seznamu úkolů, nebo ho schovat jako šablonu?
   - Doporučení: zatím zůstane viditelný, ale označit jako opakovaný template; později lze oddělit šablony.
4. Má se recurring instance vytvořit i když předchozí instance ještě není hotová?
   - Doporučení: ano pro daily/weekly rutiny; zabránit jen duplicitě pro stejný den.
5. Má recurring generator běžet přes Next API route + cron secret, nebo přímo v Express serveru jako interval?
   - Doporučení: Next API route/RPC + možnost volat z externího cronu; méně coupling s dev serverem.

## Rozhodnutí uživatele
- Expiry penalty bude per-task volitelná, default `0`.
- Recurring instance se mají vytvářet i tehdy, když předchozí instance ještě není dokončená.
- Cron spouštění bude přes chráněnou Next API route.
- Pro plán bereme doporučený expiry status set: `pending`, `in_progress`, `revision_requested`; `in_review` se neexpiruje, protože SUB už úkol odevzdal.

## Doporučený další plán
1. Ověřit reálné DB sloupce `tasks.parent_task_id`, `tasks.recurrence_config` a případně doplnit migrací.
2. Přidat migraci pro recurring idempotenci (`recurrence_instance_date`) a expiry penalty fields.
3. Přidat RPC `expire_due_tasks(...)` a `generate_recurring_tasks(...)`.
4. Přidat chráněné API route pro cron spouštění.
5. Doplnit UI v task formuláři/detailu o expiry penalty a lepší recurring popis.
6. Ověřit ručně expiry a daily recurrence na testovacích datech.
