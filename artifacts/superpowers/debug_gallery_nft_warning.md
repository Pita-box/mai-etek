# Debug: Gallery Turbopack/NFT warning

## Symptom

`pnpm --filter web build` showed:

- `Encountered unexpected file in NFT list`
- unexpected file: `apps/web/next.config.ts`
- import trace through `apps/web/src/lib/gallery/processing.ts`

## Root cause

`getFfmpegPath()` scanned possible workspace paths for `ffmpeg-static` with dynamic filesystem calls:

- `existsSync(...)`
- `readdirSync(...)`
- workspace candidates based on `process.cwd()`

Turbopack/NFT cannot safely prove the target path for those dynamic filesystem operations, so it traced the gallery page too broadly and pulled in `next.config.ts` plus much of `src`.

## Fix

`getFfmpegPath()` now avoids build-time filesystem scanning. It chooses, in order:

1. `FFMPEG_PATH`
2. `ffmpeg-static` exported path
3. `ffmpeg` / `ffmpeg.exe`

If the chosen binary is missing, the error now happens during video upload execution via `execFile`, not during build tracing.

## Verification

- `pnpm --filter web exec eslint 'src/actions/gallery.ts' 'src/lib/gallery/processing.ts'` passed.
- `pnpm --filter web exec tsc --noEmit` passed.
- `pnpm --filter web build` passed without Turbopack/NFT warning.
- `/gallery` trace after fix: `total: 268`, `src: 17`, `ffmpeg: 9`, `sharp: 32`, `nextConfig: false`.
