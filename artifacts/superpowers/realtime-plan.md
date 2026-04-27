## Goal
Zajistit, aby Tasks prostředí fungovalo realtime bez manuálního refresh:
- změna textového odevzdání
- přidaná média
- upravené komentáře
- nové komentáře
- změna stavu úkolu

## Scope
Primární UX surface:
- `/tasks` seznam + popup `TaskDetailPopup`
- SUB i DOM pohled

## Brainstorm
### Co musí být realtime
1. **Task list metadata**
   - status
   - případně počty / summary stavu
2. **Popup detail**
   - `task_attempts.text_content`
   - `task_media`
   - `task_comments`
   - task status / DOM approval state
3. **Cross-user sync**
   - SUB uloží text -> DOM to uvidí bez refresh
   - DOM přidá feedback / změní status -> SUB to uvidí bez refresh

### Pravděpodobná architektura
Nejpravděpodobnější správný směr:
- použít **Supabase Realtime subscriptions** na relevantní tabulky
- držet klientský source of truth pro otevřený popup
- refresh server dat jen jako fallback, ne jako hlavní realtime mechanismus

### Tabulky kandidáti
- `tasks`
- `task_attempts`
- `task_media`
- `task_comments`
- možná `task_user_visibility`

## Rizika
- stale state mezi server-rendered `tasks` props a client-side realtime vrstvou
- popup a list mohou divergovat, pokud budou mít oddělené stores
- Realtime payload nemusí obsahovat vše potřebné pro render bez doplňujícího refetch
- komentáře a média mohou vyžadovat merge logiku a ordering
- vyšší komplexita při kombinaci SSR + client sync

## Variants
### Varianta A — Full realtime client overlay
- list i popup přepnout na klientský synchronizovaný store
- subscriptions na všechny relevantní tabulky
- nejplynulejší UX
- vyšší implementační složitost

### Varianta B — Realtime invalidation + targeted refetch
- subscription eventy jen signalizují změnu
- klient si dotáhne čerstvý task detail / task list přes action nebo API
- jednodušší a bezpečnější
- mírně vyšší latence, ale stále bez manuálního refresh

### Varianta C — Popup realtime, list polling/refetch
- detail bude live, seznam méně okamžitý
- nejmenší scope, ale nesplňuje plně user cíl

## Recommendation
Doporučuji **Variantu B** jako první robustní krok:
- realtime eventy přes Supabase channels
- při změně konkrétního tasku klient refreshne jen dotčený task detail + případně seznam
- centralizovat merge logiku do jednoho klientského hooku/store
- menší riziko než full local store, ale UX už bude bez manuálního refresh

## Step-by-step plan
1. **Zmapovat datové zdroje a refresh boundaries**
   - Files: `apps/web/src/components/tasks/TasksClient.tsx`, `TaskDetailPopup.tsx`, `TaskEvidenceTabs.tsx`, comments/media components, `apps/web/src/actions/tasks.ts`
   - Cíl: přesně určit, co je SSR props, co je lokální state, co se musí umět invalidovat/reloadnout.
   - Verify: mít seznam všech realtime-dependent dat a komponent.

2. **Navrhnout jednotný realtime sync layer**
   - Files: nový hook/store, pravděpodobně `apps/web/src/components/tasks/useTaskRealtime.ts` nebo podobný helper
   - Cíl: subscription na `tasks`, `task_attempts`, `task_media`, `task_comments` scoped na relevant task ids.
   - Verify: definovaný event handling per table.

3. **Napojit popup na live data bez hard refresh**
   - Files: `TasksClient.tsx`, `TaskDetailPopup.tsx`, evidence/comments/media komponenty
   - Cíl: otevřený popup dostává živá data při změně textu, médií, komentářů i statusu.
   - Verify: SUB a DOM vidí změnu v otevřeném popupu bez reloadu stránky.

4. **Napojit task list na změny statusu a summary**
   - Files: `TasksClient.tsx`, případně `TaskCard.tsx`
   - Cíl: task card a filtry reagují na status/evidence změny bez refresh.
   - Verify: task se přesune mezi filtry / aktualizuje badge live.

5. **Polish + fallback behavior**
   - Cíl: odpojení subscription, reconnect, ordering komentářů/médií, cleanup listeners.
   - Verify: bez memory leaků a bez duplicitních eventů.

## Verification plan
### Static
```bash
pnpm exec eslint src/components/tasks/**/*.tsx src/actions/tasks.ts && pnpm exec tsc --noEmit
```

### Manual
1. SUB otevře popup, DOM otevře stejný popup.
2. SUB uloží text -> DOM ho vidí live.
3. SUB přidá médium -> DOM ho vidí live.
4. SUB přidá/edituje komentář -> druhá strana ho vidí live.
5. DOM změní status / schválí / odmítne -> SUB vidí změnu live.
6. Ověřit i přesuny tasku mezi DOM filtry bez refresh.

## Open question
Protože jde o UI/UX práci, podle tvých pravidel bys měl před implementací spustit:
- `/ui-ux-pro-max`

Až to schválíš, další gate je standardně:
- `APPROVED`
- potom `/superpowers-execute-plan`
