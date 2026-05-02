# Finish: Chat design rules

> Datum: 2026-04-30

## Hotovo

- Do `.agent/rules/superpowers.md` bylo přidáno pravidlo, že před každou UI prací se musí načíst `design-system/MASTER.md`.
- Pro page-specific práci se musí načíst také `design-system/pages/<page-name>.md`, pokud existuje.
- Pro Chat Page se explicitně musí načíst `design-system/pages/chat.md` po `MASTER.md`.
- Byl vytvořen `design-system/pages/chat.md` s pravidly pro sjednocení chatu se zbytkem UI.

## Chat pravidla

- Chat nesmí zavádět samostatné zelené/emerald téma.
- Primární akce v chatu používají globální crimson/rose primary barvu.
- Send button má být `bg-primary text-primary-foreground`.
- Zelená je povolená jen jako malý semantický stavový indikátor, například online tečka.
- Viditelné texty v chatu musí být česky.

## Ověření

- `sed -n '1,220p' .agent/rules/superpowers.md` → pravidlo existuje.
- `sed -n '1,260p' design-system/pages/chat.md` → Chat Page pravidla existují.

## Review

- **Blocker:** žádný.
- **Major:** žádný.
- **Minor:** zatím nebyl upraven samotný chat UI kód podle nových pravidel.
- **Nit:** `design-system/MASTER.md` je převážně anglicky; nové `chat.md` je také anglicky kvůli konzistenci design-system dokumentace.
