# Plan: Task expiry worker + recurring task generator

## Goal
Dokončit task automation pro Phase 3:
- automaticky expirovat prošlé úkoly,
- volitelně přidat per-task `discipline_points` penalizaci při expiraci,
- generovat recurring instance i když předchozí instance ještě není hotová,
- spouštět automatiku přes chráněné Next API cron route,
- zachovat idempotenci na DB úrovni.

## User Decisions
- Expiry penalty je per-task volitelná, default `0`.
- Recurring instance se vytváří i při nedokončené předchozí instanci.
- Cron spouštění bude přes chráněnou Next API route.
- Expirují stavy `pending`, `in_progress`, `revision_requested`; `in_review` se neexpiruje.

## Assumptions
- `in_review` znamená, že SUB už úkol odevzdal a čeká na DOM, takže deadline už SUBovi nemá úkol shodit.
- Recurring template zůstane zatím viditelný v task seznamu, jen bude lépe označený jako opakovaný úkol. Oddělený template manager je pozdější krok.
- Recurring MVP používá čas z `deadline`; pokud template nemá deadline, generator ho přeskočí a nevyrobí nejasnou instanci.
- Cron API route bude chráněná přes `CRON_SECRET`; hodnotu je potřeba doplnit do `.env` / deployment env, ale plán nebude zapisovat žádné existující secrets.
- Datovou bezpečnost a idempotenci drží DB/RPC. API route je pouze spouštěč.

## Plan
1. Ověřit reálné linked Supabase schema
   - Commands:
     - `pnpm exec supabase db query --linked "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name in ('parent_task_id','recurrence_config','recurrence_instance_date','expiry_penalty_points','expiry_penalty_reason','expired_at');"`
     - `pnpm exec supabase db query --linked "select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.tasks'::regclass and contype in ('c','u');"`
   - Goal:
     - zjistit, které sloupce už reálně existují,
     - vyhnout se migraci založené jen na starém `database/migrations` návrhu.
   - Verify: výstup uložit do pracovního kontextu a podle něj upravit migraci.

2. Přidat migraci pro task automation schema
   - File: nový `supabase/migrations/<timestamp>_task_automation.sql`.
   - Add/ensure columns:
     - `tasks.parent_task_id uuid references public.tasks(id) on delete set null`
     - `tasks.recurrence_config jsonb not null default '{}'::jsonb`
     - `tasks.recurrence_instance_date date`
     - `tasks.expiry_penalty_points integer not null default 0 check >= 0`
     - `tasks.expiry_penalty_reason text`
     - `tasks.expired_at timestamptz`
   - Add indexes:
     - active deadline index for expiry lookup (`deadline`, `status`)
     - recurring template lookup (`recurrence`, `parent_task_id`)
     - unique partial index `(parent_task_id, recurrence_instance_date)` where both are not null.
   - Update status constraint if needed to include `expired`.
   - Verify: linked migration apply + column/index checks.

3. Přidat RPC `public.expire_due_tasks(run_limit integer default 100)`
   - File: stejná migrace.
   - Behavior:
     - vybere due tasks přes `FOR UPDATE SKIP LOCKED`, limitovaný batch,
     - statusy: `pending`, `in_progress`, `revision_requested`,
     - `deadline < now()`,
     - nastaví `status = 'expired'`, `expired_at = now()`, `updated_at = now()`,
     - upsertne `user_stats`, zvýší `tasks_failed += 1`, nastaví `current_streak = 0`,
     - pokud `expiry_penalty_points > 0`, přidá `discipline_points` a `xp_transactions` s `source_type = 'task_expiry_penalty'` a `source_id = task.id`,
     - vytvoří `public.create_activity_notification(...)` pro SUB i DOM.
   - Idempotence:
     - update jen pokud status stále aktivní,
     - ledger `task_expiry_penalty` používá unique source `(user_id, source_type, source_id)`; pokud už existuje, nepřidá se znovu,
     - notifications použijí dedupe keys `task_expired:<task_id>:sub/dom`.
   - Verify:
     - testovací úkol s deadline v minulosti se expiruje přes RPC,
     - opakované zavolání RPC nezdvojí debt ani notification.

4. Přidat RPC `public.generate_recurring_tasks(run_date date default Prague today, run_limit integer default 100)`
   - File: stejná migrace.
   - Template selection:
     - `recurrence != 'none'`
     - `parent_task_id IS NULL`
     - `deadline IS NOT NULL`
     - status není `cancelled` ani `expired`
   - Frequency:
     - `daily`: každý `run_date`
     - `weekly`: jen pokud Prague day-of-week odpovídá template deadline/created_at
     - `monthly`: jen pokud Prague day-of-month odpovídá template deadline/created_at
   - Instance insert:
     - kopíruje title, description, assigned_by, assigned_to, priority, points_reward,
     - `status = 'in_progress'`,
     - `recurrence = 'none'`,
     - `parent_task_id = template.id`,
     - `recurrence_instance_date = run_date`,
     - `deadline = run_date + time(template.deadline)` v Europe/Prague,
     - kopíruje `expiry_penalty_points` a `expiry_penalty_reason`.
   - Idempotence:
     - unique partial index `(parent_task_id, recurrence_instance_date)`,
     - `ON CONFLICT DO NOTHING`.
   - Notifications:
     - pro novou instanci vytvořit task badge pro SUB: `Nový opakovaný úkol`.
   - Verify:
     - daily template vytvoří jednu instanci pro dnešek,
     - opakované spuštění pro stejný den nevytvoří duplicitu,
     - weekly/monthly se vytvoří jen ve správný den.

5. Přidat Next API cron routes
   - Files:
     - `apps/web/src/app/api/cron/tasks/expire/route.ts`
     - `apps/web/src/app/api/cron/tasks/recurring/route.ts`
     - případně společný helper `apps/web/src/lib/cron/auth.ts`.
   - Auth:
     - kontrola `Authorization: Bearer <CRON_SECRET>` nebo `x-cron-secret`.
     - pokud chybí `CRON_SECRET`, route vrátí 503/konfigurační chybu.
   - Behavior:
     - route používá Supabase server/admin client podle existujících možností,
     - zavolá příslušné RPC,
     - vrátí JSON `{ success, expired_count/generated_count }`.
   - Verify:
     - bez secret 401/403,
     - se secret spustí RPC.

6. Doplnit server actions pro task fields
   - File: `apps/web/src/actions/tasks.ts`.
   - `createTask` a `updateTask` budou číst:
     - `expiry_penalty_points`,
     - `expiry_penalty_reason`,
     - `recurrence_config` pokud bude potřeba default/future data.
   - Normalizace:
     - penalty body integer >= 0,
     - reason trim/null,
     - pokud recurrence != `none` a deadline chybí, vrátit jasnou chybu nebo neumožnit uložit recurring bez deadline.
   - Verify: tsc + ruční vytvoření tasku s penalty a recurrence.

7. Doplnit Task UI
   - Files:
     - `apps/web/src/app/(dashboard)/tasks/new/page.tsx`
     - `apps/web/src/components/tasks/DomTaskControls.tsx`
     - `apps/web/src/components/tasks/TaskDetailContent.tsx`
     - `apps/web/src/components/tasks/TaskCard.tsx`
     - `apps/web/src/types/task.ts`
   - New task form:
     - přidat volitelné `Kázeňská penalizace při prošlém termínu` body, default 0,
     - důvod penalizace, fallback text podle title,
     - u recurrence zobrazit krátký hint, že generator používá čas deadline.
   - DOM edit controls:
     - umožnit upravit expiry penalty fields,
     - zachovat recurrence select.
   - Detail/card:
     - zobrazit `expired` stav jasně,
     - u recurring template/instance zobrazit jednoduchý štítek `Opakovaný` / `Instance`.
   - Verify: UI nevytváří horizontální overflow a hodnoty se ukládají.

8. Dokumentace a artifacts
   - Files:
     - `docs/ARCHITECTURE.md`
     - `artifacts/superpowers/finish.md`
   - Update:
     - Phase 3 `Task expiry worker` označit hotovo po implementaci,
     - `Recurring task generator` označit hotovo po implementaci,
     - popsat cron route + CRON_SECRET + idempotenci.
   - Verify: `git diff --check`.

9. Kompletní ověření
   - Commands:
     - `pnpm exec supabase db query --linked --file supabase/migrations/<timestamp>_task_automation.sql`
     - `pnpm --filter web exec tsc --noEmit`
     - targeted ESLint pro upravené soubory
     - `pnpm --filter web build`
     - `git diff --check -- <upravené soubory>`
   - Manual smoke:
     - Vytvořit úkol s deadline v minulosti a penalty 0, zavolat expire route, ověřit `expired` + notifications, žádný debt.
     - Vytvořit úkol s deadline v minulosti a penalty > 0, zavolat expire route, ověřit `discipline_points` + ledger.
     - Zavolat expire route znovu, ověřit bez duplicit.
     - Vytvořit daily recurring template s deadline dnes, zavolat recurring route, ověřit jednu instanci.
     - Zavolat recurring route znovu pro stejný den, ověřit bez duplicity.

## Risks & Mitigations
- Duplicity při paralelním cron spuštění.
  - Mitigation: `FOR UPDATE SKIP LOCKED`, partial unique index, `ON CONFLICT DO NOTHING`.
- Nesprávné timezone u recurring deadlines.
  - Mitigation: generovat instance podle Prague local date/time.
- Cron route nebude volaná automaticky.
  - Mitigation: route bude připravená; deployment musí přidat scheduler volání každých 60s pro expiry a denně pro recurring.
- Chybějící `CRON_SECRET` v env.
  - Mitigation: route failne bezpečně a dokumentace řekne, že je potřeba doplnit.
- Citlivé secrets byly vložené do chatu.
  - Mitigation: neukládat/neopisovat hodnoty; po práci doporučit rotaci.

## Rollback Plan
- Pokud selže UI, ponechat migraci/RPC a skrýt nové form fields do opravy.
- Pokud selže cron route, lze RPC spouštět ručně přes Supabase query do opravy route.
- Pokud selže recurring generator, vypnout recurring route; expiry worker může fungovat samostatně.
- DB rollback řešit follow-up migrací, ne mazáním historie tasků/ledgeru.
