# Review: Phase 6 Batch 1-15

## Blocker

- Žádný.

## Major

- Žádný.

## Minor

- Full-size/lightbox obrázky zatím nejsou přes Next image optimizer. Jsou za auth-protected API route, takže bezpečná optimalizace potřebuje samostatný návrh pro proxy/auth; thumbnails používají `next/image` v `unoptimized` režimu.
- Task video player je teď lazy-loaded, takže první otevření video média stáhne samostatný `video.js` chunk cca `680 KB` plus CSS cca `48 KB`; běžné načtení task listu/detailu tím není zatížené.
- Phase 6 DB index migrace je aplikovaná na remote a migration history je srovnaná.
- Redis cache je zatím úzký slice pouze pro serverový chat search endpoint. Aktivuje se jen s `REDIS_URL`; bez něj endpoint běží bez cache.
- Realtime chat feed a unread stav nejsou cacheované záměrně, aby se nerozbily živé zprávy a badge/read stavy.
- Testing je zavedený jako praktický Phase 6 základ: server unit/API integration, web unit + Playwright login smoke a Chrome Extension unit testy běží přes root `pnpm test`. Pokrytí je pořád smoke/foundation, ne vyčerpávající test každé obrazovky a business mutace.
- Gallery upload processing stále vyžaduje runtime dostupný ffmpeg (`FFMPEG_PATH`, `ffmpeg-static`, nebo systémové `ffmpeg`). Chybějící binárka se nově projeví při uploadu videa, ne při buildu.
- Gallery masonry karty nejsou animované schválně; animace by mohla způsobit layout shift v column layoutu.
- Monitoring timelines a screenshot grid nejsou animované schválně; seznamy mohou být dlouhé a animace by přidala zbytečnou zátěž.
- Chat toast success není úmyslně zobrazený po každé textové zprávě, aby chat nepůsobil rušivě; pokryté jsou chyby a destruktivní/viditelnější akce.
- Task toasty jsou napojené na současné klientské mutace; legacy komponenty `EvidenceUpload` a `TaskForm` nejsou v aktuálním runtime nikde použité.
- Superadmin stále používá tabulkový layout; polish byl záměrně úzký a nepřepisoval strukturu obrazovky.
- Rewards claim approved stav zůstává zelený jako drobný success stav; reward active stav byl převedený na primary akcent.
- Inline error/success text v některých starších formulářích zůstává vedle nových toastů, aby se neztratil persistentní kontext u dlouhých formulářů.

## Nit

- Žádný.
