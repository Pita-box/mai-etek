# Debug: Task Video Bundle Split

## Kontext

Phase 6 Performance krok navázal na bundle analysis. Před změnou patřily mezi největší client chunky:

- `/tasks` -> cca `768 KB`,
- `/tasks/[id]` -> cca `768 KB`.

Oba obsahovaly `video.js` / `videojs`.

## Příčina

Import chain:

- `TaskMediaGallery`
- `TaskMediaLightbox`
- `TaskVideoPlayer`
- `video.js`
- `video.js/dist/video-js.css`

`TaskMediaLightbox` se dostal do task route client grafu staticky, takže se `video.js` přibalil do počátečních route chunků, i když je potřeba jen po otevření video média v lightboxu.

## Oprava

`apps/web/src/components/tasks/TaskMediaLightbox.tsx` teď načítá `TaskVideoPlayer` přes `next/dynamic`:

- `ssr: false`,
- spinner fallback přes `Loader2`,
- beze změny API `TaskVideoPlayer`.

## Ověření

- `pnpm --filter web exec eslint 'src/components/tasks/TaskMediaLightbox.tsx' 'src/components/tasks/TaskVideoPlayer.tsx'` -> prošlo.
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web build` -> prošlo.
- `pnpm --filter web exec next experimental-analyze --output` -> prošlo.

Build smoke po změně:

- `rg -l 'videojs|Video\\.js|video\\.js' apps/web/.next/static/chunks` našel pouze `apps/web/.next/static/chunks/0jat999ze~i6y.js`.
- `du -k apps/web/.next/static/chunks/0jat999ze~i6y.js` -> `680 KB`.
- `du -k apps/web/.next/static/chunks/0pcu84lvjbdmb.css` -> `48 KB`.
- `rg -l 'videojs|Video\\.js|video\\.js' apps/web/.next/server/app apps/web/.next/server/chunks` -> bez výskytu.
- `/tasks` a `/tasks/[id]` mají video chunk pouze v `react-loadable-manifest.json`, tedy jako lazy asset.

## Závěr

`video.js` už nezatěžuje počáteční task list/detail route load. Cena přehrávače se platí až při prvním otevření video média v task lightboxu.
