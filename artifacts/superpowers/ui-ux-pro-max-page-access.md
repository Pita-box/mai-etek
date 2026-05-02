# UI/UX Pro Max: SuperAdmin page access chips

## Scope
- SuperAdmin nastavení dostupnosti stránek pro SUB.
- Navigace a access denied stav pro SUB.
- Nejde o redesign celé SuperAdmin stránky, jen o nahrazení checkboxů za jasné page chips.

## Design směr
- Držet Obsidian Glassmorphism styl aplikace.
- Žádný hero/landing styl; je to provozní administrace.
- Štítky musí být rychle skenovatelné a ovladatelné jedním klikem.

## Page permission chips
- Každá stránka je jeden chip/button s ikonou a názvem.
- Povolená stránka:
  - primary button styl (`bg-primary`, bílé písmo),
  - text `Povoleno`,
  - ikona potvrzení nebo aktivní stav.
- Nepovolená stránka:
  - destructive button styl (`border-rose`, `bg-rose-500/10`, `text-rose-100`),
  - text `Nepovoleno`,
  - ikona lock/ban.
- Chip musí obsahovat název stránky a stav, aby barva nebyla jediný signál.
- Chips se mají zalamovat do více řádků a nesmí rozbíjet tabulku na mobilu.

## SuperAdmin layout
- U každého SUB zobrazit sekci `Přístup ke stránkám`.
- Nepoužívat checkboxy pro page access.
- Vedle sekce zobrazit stručný hint: nové dashboard stránky se objeví automaticky a jsou defaultně povolené, dokud je DOM nevypne.
- Loading stav při ukládání: disabled chip + spinner nebo jemný text `Ukládám`.
- Error stav: `role="alert"`.

## Access denied stav
- Když SUB otevře nepovolenou stránku, zobrazit jednoduchý glass panel.
- Text přesně: `K této stránce nemáš přístup.`
- Přidat sekundární akci zpět na `/dashboard` nebo první povolenou stránku.
- Žádný technický detail ani návod, jak obejít přístup.

## Responsive pravidla
- 375px: chips pod sebou / 2 sloupce podle délky názvu, žádný horizontální scroll tabulky kvůli chipům.
- Desktop: chips v kompaktním wrap gridu.
- Dlouhé názvy stránek se zalomí nebo zkrátí s `min-w-0`.

## Accessibility
- Button aria-label: `<Název stránky>: povoleno/nepovoleno pro SUB`.
- Focus ring viditelný.
- Stav je vyjádřen ikonou + textem, ne jen barvou.
- Disabled během ukládání.
