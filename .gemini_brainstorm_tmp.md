# Tasks Text Evidence Brainstorm

## Goal
Upravit sekci `TaskTextEvidence` na stránce Tasks tak, aby:
- pro **SUB** fungovala jako primární textové odevzdání úkolu,
- nabízela větší editační plochu pro delší popis splnění úkolu,
- šla průběžně upravovat / aktualizovat,
- pro **DOM** správně zobrazovala obsah bez hard-coded fallbacku,
- a aby bylo jasné, jak náročné je případně doplnit základní rich text editor.

## Constraints
- Celé UI i systémové texty musí zůstat v češtině.
- Musí se zachovat současný task workflow bez regresí pro `task_attempts` a `task_evidence`.
- Rozdílné chování pro SUB vs DOM musí být řízeno podle aktuální role / vztahu k tasku.
- Pokud bude editace textového odevzdání průběžná, musí být jasné, kam se data ukládají a jak se verzuje / přepisuje.
- Rich text nesmí otevřít XSS rizika; HTML render musí být sanitizovaný.
- Pokud se přidá editor, měl by být přiměřeně lehký vzhledem k rozsahu funkcí.

## Known context
- Aktuální komponenta `apps/web/src/components/tasks/TaskTextEvidence.tsx` jen čte poslední text z `task.task_attempts[0].text_content` nebo fallback z `task.task_evidence`.
- Když text neexistuje, komponenta zobrazuje hard-coded text: `Zatím nebylo přidáno textové odevzdání.`
- Už existuje komentářové vlákno, které má sloužit jako komunikace mezi DOM a SUB nad textovým odevzdáním.
- SUB požaduje velkou textarea-like plochu jako hlavní obsah odevzdání.
- DOM dnes v empty state vidí nevhodný fallback; cílově má dávat smysl zobrazit editovatelný / čitelný stav podle role.
- Uživatel se ptá i na rich text rozsah: tučnost, kurzíva, odrážky, odkazy, auto-link URL, image embed z URL a video embed z URL / iframe.

## Risks
- Není ještě potvrzené, zda `TaskTextEvidence` už dnes dostává informaci o viewer roli, nebo bude potřeba rozšířit parent data flow.
- Není ještě potvrzené, zda textové odevzdání má být draft-průběžně ukládané, nebo až explicitně odeslané jako finální submit.
- Pokud se použije plný rich text editor, může to zvednout komplexitu, bundle size i počet edge casů.
- Render HTML / embedů vyžaduje sanitizaci, allowlist tagů a bezpečné zacházení s iframe/video URL.
- Auto-detekce URL a embed pravidla mohou být překvapivá bez jasně definovaného parseru.
- Pokud se bude přepisovat `latestAttempt.text_content`, může to kolidovat s existující logikou submission flow.

## Options (2–4)
### Option 1 — Velká plaintext textarea bez rich textu
- SUB dostane velkou textarea jako hlavní odevzdání.
- DOM uvidí obsah jen read-only.
- Komentáře zůstanou oddělené.
- Výhoda: nejrychlejší, nejnižší riziko.
- Nevýhoda: bez formátování a embedů.

### Option 2 — Markdown-like editor bez plného WYSIWYG
- Ukládat prostý text / markdown-ish syntax.
- Přidat lehký toolbar pro `**tučnost**`, `*kurzíva*`, seznamy, odkazy a auto-linking.
- Renderovat přes bezpečný markdown renderer se sanitizací.
- Obrázky a videa řešit přes URL parsing a render pravidla.
- Výhoda: výrazně nižší komplexita než plný rich text editor.
- Nevýhoda: není to plně WYSIWYG; uživatel trochu pracuje se syntaxí.

### Option 3 — Lehký rich text editor (např. TipTap / ProseMirror-lite konfigurace)
- Přidat základní toolbar: bold, italic, bullet list, ordered list, link.
- Auto-link URL, image node z URL, video node přes URL parser.
- Výhoda: nejlepší UX.
- Nevýhoda: vyšší implementační náročnost, serializace obsahu, sanitizace a renderer pro DOM view.

### Option 4 — Hybrid: textarea teď, rich text později
- Teď rychle opravit UX a role-based chování s velkou textarea.
- Datový model připravit tak, aby později šel obsah migrovat na markdown / rich text JSON.
- Výhoda: rychlé dodání bez zablokování feature.
- Nevýhoda: druhá fáze bude později vyžadovat další migraci / rendering práci.

## Recommendation
Doporučuji **Option 4 s cílovou architekturou blízkou Option 2**.

Prakticky:
1. **Teď** upravit `TaskTextEvidence` na role-based komponentu:
   - SUB: velká textarea pro hlavní textové odevzdání + možnost aktualizace.
   - DOM: read-only render textu; když nic není, neukazovat zavádějící hard-coded hlášku, ale smysluplný empty state nebo disabled editor-like blok.
2. Ujasnit perzistenci:
   - buď draft pole na task/attempt,
   - nebo průběžná editace posledního attempt draftu.
3. **Rich text neimplementovat hned jako full editor**, ale navrhnout obsah tak, aby později šel rozšířit na markdown-like formát.
4. Pokud je rich text opravdu priorita, preferovat **markdown + toolbar + bezpečný renderer** před plným WYSIWYG editorem.

### Odhad náročnosti rich text editoru
- **Základní velká textarea bez RTE**: nízká náročnost.
- **Markdown-like toolbar + renderer + auto-link + image/video URL embeds**: střední náročnost.
- **Plný rich text editor s embedy a bezpečným renderingem**: středně vysoká až vysoká náročnost.

Nejnáročnější části nejsou samotná tlačítka toolbaru, ale:
- bezpečný rendering,
- serializace a persistence formátu,
- URL parsing pro image/video/embed,
- zpětná kompatibilita se stávajícím textovým obsahem,
- odlišení DOM/SUB UX stavů.

## Acceptance criteria
- SUB na Tasks page vidí v `TaskTextEvidence` velkou vstupní plochu pro hlavní textové odevzdání.
- SUB může text uložit a později znovu upravit / aktualizovat.
- DOM nevidí hard-coded text `Zatím nebylo přidáno textové odevzdání.` v nevhodném stavu.
- DOM vidí buď skutečné textové odevzdání, nebo smysluplný empty state podle reality dat.
- Komentáře zůstávají oddělené jako komunikační vlákno k textovému odevzdání.
- Je rozhodnuto, zda textové odevzdání zůstane plaintext, markdown-like, nebo full rich text.
- Pokud se zvolí rich text, je explicitně definován bezpečný render a povolené formátování / embedy.
