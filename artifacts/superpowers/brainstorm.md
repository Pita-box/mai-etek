# Brainstorm: Automatická správa SUB přístupu ke stránkám

## Cíl
DOM má v SuperAdmin nastavení vidět automatický seznam dashboard stránek a u každé jednoduše nastavit, zda je pro SUB povolená nebo nepovolená. Nové budoucí stránky se mají v seznamu objevit bez ručního dopisování do SuperAdmin UI nebo Navigation komponenty.

## Upřesnění od uživatele
- Nejde o jednorázové ruční schování jedné stránky.
- Jde o budoucí systém, aby nové stránky nebylo nutné ručně ošetřovat v kódu pro SUB viditelnost.
- DOM nastavuje dostupnost ve webovém rozhraní.
- UI má být jako štítky/chips:
  - povolené stránky jako primary button,
  - nepovolené stránky jako destructive button.
- Pokud SUB otevře nepovolenou stránku přes URL, má vidět hlášku: `K této stránce nemáš přístup.`

## Současný stav
- `profiles.app_config` už existuje jako JSONB.
- SuperAdmin stránka dnes zapisuje starý tvar `app_config.modules.chat/tasks/gallery` přes checkboxy.
- `Navigation.tsx` dnes filtruje položky přes jiný tvar `app_config[pageKey].enabled`, takže stávající SuperAdmin toggly nejsou konzistentní s navigací.
- `Navigation.tsx` má ruční `allNavItems`; to není budoucí-proof.
- Monitoring stránka zatím v `apps/web/src/app/(dashboard)` neexistuje, ale nav item existuje ručně.

## Návrh směru
- Zavést centrální page access registry pro dashboard stránky.
- Registry bude automaticky procházet top-level routes pod `apps/web/src/app/(dashboard)` a vyrábět page keys/hrefs.
- Pro známé stránky se použijí hezké české labely a ikony z override mapy; neznámá nová stránka dostane fallback label z URL segmentu a default ikonu.
- Přístup SUB se bude číst z `profiles.app_config.page_access`.
- Nová stránka bez explicitního nastavení bude defaultně povolená, aby splnila požadavek `povolené (default) nebo nepovolené`.
- System-only stránky jako `/superadmin` zůstanou DOM-only a nebudou konfigurovatelné pro SUB.
- Jedna společná kontrola v dashboard layoutu bude rozhodovat, zda SUB smí vidět aktuální route; při zamítnutí zobrazí access denied stav.

## Otevřené rozhodnutí / předpoklad
- Předpokládám, že `/superadmin` zůstává vždy DOM-only a nebude možné ho SUBovi odemknout.
- Předpokládám, že top-level page permission platí i pro child routes, např. zakázané `/tasks` zakáže i `/tasks/[id]` a `/tasks/new`.
- Předpokládám, že nové stránky jsou defaultně povolené pro SUB, dokud je DOM nevypne.

## Rizika
- Runtime čtení filesystemu v Next produkčním buildu musí být udělané opatrně; projekt je self-hosted, takže je to přijatelné, ale je vhodné mít fallback pro známé routes.
- Samotný UI guard není náhrada za RLS u dat. Citlivá data musí dál chránit Supabase RLS/server actions.
- Pokud se layout guard udělá čistě client-side, stránka se může krátce načítat. UX to vyřeší loading stav; bezpečnost drží RLS.

## Akceptační kritéria
- SuperAdmin automaticky zobrazí všechny top-level dashboard pages kromě system-only výjimek.
- DOM přepne stránku jedním chip buttonem.
- Povolená stránka je primary chip/button, nepovolená destructive chip/button.
- SUB navigace ukáže jen povolené stránky.
- SUB při otevření nepovolené URL uvidí `K této stránce nemáš přístup.`
- Přidání nové top-level dashboard stránky nevyžaduje úpravu SuperAdmin UI ani Navigation listu.
