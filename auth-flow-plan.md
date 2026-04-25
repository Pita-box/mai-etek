# Phase 2: Authentication Flow Implementation Plan

This plan builds upon the Phase 1 scaffolding to implement a complete authentication flow using Supabase, Express backend, and Next.js frontend.

## 1. Configure Supabase Client in `packages/db`

**Objective:** Set up a shared, typed Supabase client that can be used across the monorepo (specifically by the Express server).

**Tasks:**
- Install `@supabase/supabase-js` if not already present in `packages/db`.
- Create `src/index.ts` (or relevant file) to initialize and export the Supabase client.
- Ensure the client uses environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Create helper functions to initialize two types of clients:
  - Standard client (using anon key) for regular operations.
  - Admin client (using service_role key) for backend tasks requiring elevated privileges (like auth administrative actions).
- Export types if needed.
- Ensure `packages/db` builds correctly and exposes the client.

## 2. Implement API Auth Logic in Express Server

**Objective:** Build the actual business logic for `/api/auth/register` and `/api/auth/login` endpoints using the Supabase Admin client.

**Tasks:**
- Import the Supabase Admin client from `@domsub/db` (or initialize it within the server if package linking is an issue, but shared package is preferred).
- **Registration (`/api/auth/register`):**
  - Implement request body validation (e.g., using `zod` for email, password, and optionally name).
  - Use Supabase Admin Auth (`supabase.auth.admin.createUser`) to create a new user account.
  - *Optional:* Add logic to insert corresponding user profile data into a custom `users` table if needed.
  - Return appropriate success response or error messages (e.g., "User already exists").
- **Login (`/api/auth/login`):**
  - Implement request body validation (email, password).
  - Use standard Supabase Auth (`supabase.auth.signInWithPassword`) to authenticate the user and obtain session tokens (access token, refresh token).
  - Return the session tokens and user data in the response.
- **Middleware:**
  - Update or create auth middleware to verify Supabase JWTs for protected routes.
- **Error Handling:** Ensure proper error handling and standard JSON error responses.

## 3. Implement Frontend UI and Connect to API

**Objective:** Build functional login and registration forms in Next.js and connect them to the Express backend.

**Tasks:**
- **UI Components:**
  - Create reusable Form components (Input, Button, Label) if not using a library like `shadcn/ui`, erotic vibe UI!!
  - Please read design-system/MASTER.md.
  - Also check if design-system/pages/[page-name].md exists.
  - If the page file exists, prioritize its rules.
  - If not, use the Master rules exclusively.
  - Implement the UI for `app/(auth)/login/page.tsx` with email and password fields.
  - Implement the UI for `app/(auth)/register/page.tsx` with email, password, and confirm password fields.
- **State Management:**
  - Add client-side form state management (e.g., using `useState` or `react-hook-form`).
  - Add loading states for form submission.
- **API Integration:**
  - Create functions to call the Express backend endpoints (`POST /api/auth/login` and `POST /api/auth/register`).
  - Handle success responses (e.g., store tokens in cookies or local storage, redirect user to dashboard).
  - Handle error responses (display error messages in the UI).
- **Authentication Context/Hook (Optional but recommended):**
  - Create a React context or custom hook to manage authentication state globally within the Next.js app.
- **Routing:** Ensure redirection logic works (e.g., redirect away from login page if already authenticated).

## Execution Notes
- Ensure environment variables are correctly loaded in both the Next.js app and the Express server.
- Test the flow thoroughly: successful registration, successful login, incorrect credentials, and duplicate registration attempts.
- Verify CORS settings on the Express server allow requests from the Next.js frontend during development.
