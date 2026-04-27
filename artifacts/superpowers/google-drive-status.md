# Google Drive setup status

## Current state
Google Drive integration for task media is **partially implemented and code-wired**, but the overall setup is **not yet confirmed as complete**.

## What is already implemented

### 1. Server-side Google Drive helper exists
File:
- `apps/web/src/lib/google-drive/tasks.ts`

Implemented:
- JWT auth via Google service account
- required env loading:
  - `GOOGLE_DRIVE_CLIENT_EMAIL`
  - `GOOGLE_DRIVE_PRIVATE_KEY`
- folder structure creation on Drive:
  - `MAIETEK`
  - `Úkoly`
  - per-task folder based on slug + task id suffix
- file upload to Google Drive
- returned metadata:
  - Drive file id
  - Drive webViewLink
  - folder id
  - filename
  - mime type
  - size

### 2. Task media upload action is connected end-to-end
File:
- `apps/web/src/actions/tasks.ts`

Implemented in `uploadTaskMedia(...)`:
- auth/session check
- file presence/type/size validation
- task lookup
- call to `uploadTaskFileToDrive(...)`
- insert metadata into `task_media`
- notification insert for DOM when SUB uploads media
- task page revalidation

### 3. UI upload component is wired
File:
- `apps/web/src/components/tasks/TaskMediaUpload.tsx`

Implemented:
- file picker
- image/video mode
- upload action call
- success/error feedback
- explicit user-facing copy saying the file is stored server-side to Google Drive

## What I did NOT find
- no prior Google Drive plan artifact in current conversation artifacts
- no visible `.env` confirmation in repo that Drive credentials are actually present
- no explicit setup validation script / health check
- no browser/manual verification evidence that uploads were successfully tested against a real Drive account
- no visible handling of Drive sharing/permissions policy beyond upload itself
- no cleanup/rollback strategy if DB insert succeeds or fails asymmetrically with Drive upload

## Important gap assessment
The code path exists, but “setup complete” depends on runtime configuration and real verification.

### Most likely remaining blockers
1. **Environment variables may still be missing**
   - `GOOGLE_DRIVE_CLIENT_EMAIL`
   - `GOOGLE_DRIVE_PRIVATE_KEY`

2. **Service account access may not be fully prepared**
   - the service account must be valid
   - if a shared drive or specific folder ownership model is required, Drive permissions must match that model

3. **No confirmed live upload test yet**
   - we still need one real image/video upload and confirmation that:
     - file appears in Drive
     - `task_media` row is created
     - link/id values are saved correctly
     - DOM notification is created

4. **Potential consistency edge case**
   - if Drive upload succeeds but DB insert fails, orphaned Drive files can remain

## Practical conclusion
### Status: **implementation mostly present, operational setup not yet fully verified**

If you want to move this to “done”, the next step should be:
1. audit env presence
2. verify Drive account/service-account permissions
3. run one live upload test
4. optionally harden failure handling for Drive/DB consistency
