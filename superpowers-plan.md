# Superpowers Implementation Plan

This plan breaks down the implementation of the SuperAdmin (DOM) and Submissive (SUB) architecture described in `superpowers-brainstorm.md` into atomic, verifiable steps.

## Phase 1: Database Schema Updates

**Goal:** Extend the database schema to support the claiming mechanism, dynamic app configuration, and secure password storage.

*   [ ] **Step 1.1: Update `profiles` table**
    *   **Action:** Add `dom_id` (UUID, nullable, references `profiles.id`) to track which DOM claimed the user.
    *   **Action:** Add `app_config` (JSONB, default to `{}`) to store dynamic section visibility settings (e.g., `{"chat": {"enabled": true}, "tasks": {"enabled": false}}`).
    *   **Action:** Ensure `role` column exists (enum or text: 'unassigned', 'sub', 'dom') defaulting to 'unassigned'.
    *   **Verification:** Run a SQL query to verify the new columns exist and have the correct types and defaults.

*   [ ] **Step 1.2: Create `user_vault` table**
    *   **Action:** Create a highly restricted `user_vault` table.
    *   **Columns:** `id` (UUID, Primary Key), `user_id` (UUID, references `auth.users`, unique), `encrypted_password` (text).
    *   **Action:** Enable Row Level Security (RLS) on `user_vault`. Ensure only service role / backend API can insert and read from this table.
    *   **Verification:** Verify the table exists and standard client-side queries are denied by RLS.

## Phase 2: Backend API (`apps/server`)

**Goal:** Implement the secure endpoints required to manage passwords and user relationships, bypassing direct client-to-Supabase calls for sensitive operations.

*   [ ] **Step 2.1: Setup Encryption Utilities**
    *   **Action:** Add a symmetric encryption utility function (e.g., using `crypto` module in Node.js) utilizing an environment variable secret key (`VAULT_ENCRYPTION_KEY`).
    *   **Verification:** Write a quick unit test or script to verify encrypting and then decrypting a string yields the original string.

*   [ ] **Step 2.2: Update `/register` Endpoint (Dual-Storage)**
    *   **Action:** Modify the existing `/register` API (or create a new one). It should accept `email` and plain-text `password`.
    *   **Action:** Call Supabase Admin API `createUser` to register the user in `auth.users`.
    *   **Action:** Encrypt the plain-text `password`.
    *   **Action:** Insert a record into `user_vault` with the new user's ID and the encrypted password.
    *   **Verification:** Register a test user. Verify they exist in Supabase Auth and that a record exists in `user_vault` with an encrypted string.

*   [ ] **Step 2.3: Create `/vault/reveal` Endpoint**
    *   **Action:** Create a GET endpoint (e.g., `/vault/reveal/:userId`).
    *   **Action:** Add authorization logic: Ensure the user making the request has the `role` of 'dom'.
    *   **Action:** Fetch the `encrypted_password` from `user_vault` for the target `userId`.
    *   **Action:** Decrypt the password and return it in the response payload.
    *   **Verification:** Call the endpoint as a DOM and verify plain-text password is returned. Call it as a regular user and verify it returns a 403 Forbidden.

*   [ ] **Step 2.4: Create `/claim` Endpoint**
    *   **Action:** Create a POST endpoint (e.g., `/claim/:subId`).
    *   **Action:** Add authorization logic: Ensure the requester is a 'dom'.
    *   **Action:** Update the `profiles` table for `subId`: Set `dom_id` to the requester's ID and `role` to 'sub'.
    *   **Verification:** Call the endpoint and verify the target profile is updated correctly in the database.

*   [ ] **Step 2.5: Create `/config` Update Endpoint**
    *   **Action:** Create a PATCH or PUT endpoint (e.g., `/config/:subId`).
    *   **Action:** Add authorization logic: Ensure the requester is a 'dom' and that the requester's ID matches the `dom_id` of the target `subId`.
    *   **Action:** Update the `app_config` JSONB column for the target `subId` with the provided payload.
    *   **Verification:** Call the endpoint with a new JSON payload and verify the `app_config` in the database is updated.

## Phase 3: Frontend (`apps/web`)

**Goal:** Build the UI for the SuperAdmin to manage SUBs and for SUBs to experience the locked/unlocked states.

*   [ ] **Step 3.1: SuperAdmin Dashboard - User List**
    *   **Action:** Create a new page/view for the SuperAdmin Dashboard.
    *   **Action:** Fetch and display a list of all users from the `profiles` table. Indicate their current status (unassigned vs. claimed).
    *   **Verification:** Verify the list renders correctly based on mock database data.

*   [ ] **Step 3.2: SuperAdmin Dashboard - Claim & Reveal Actions**
    *   **Action:** Add a "Claim" button next to unassigned users that calls the `/claim` API.
    *   **Action:** Add an "eye icon" or "Reveal Password" button that calls the `/vault/reveal` API and displays the result in a modal or inline.
    *   **Verification:** Click "Claim" and verify the UI updates (and backend state changes). Click "Reveal Password" and ensure the correct password shows.

*   [ ] **Step 3.3: SuperAdmin Dashboard - Config Editor**
    *   **Action:** For claimed users, add a UI component (e.g., toggle switches) mapping to the keys in `app_config` (e.g., Chat, Tasks, Gallery).
    *   **Action:** Wire these toggles to call the `/config` update API.
    *   **Verification:** Toggle a setting, refresh the page, and ensure the setting persists.

*   [ ] **Step 3.4: "Waiting for DOM" Screen (`page.tsx`)**
    *   **Action:** Update the main entry page (or a protected route wrapper) to check the user's `role` and `dom_id`.
    *   **Action:** If `role` is 'unassigned' or `dom_id` is null, render a specific "Waiting for DOM" UI and block navigation to other app features.
    *   **Verification:** Login as an unassigned user and verify the lock screen appears and cannot be bypassed.

*   [ ] **Step 3.5: Dynamic Sidebar/Navigation (`DashboardLayout`)**
    *   **Action:** Update the `DashboardLayout` component to read the current user's `app_config`.
    *   **Action:** Conditionally render navigation links based on the configuration. For example, if `app_config.chat.enabled` is false (or undefined), do not render the Chat link.
    *   **Verification:** Login as a claimed user. Modify their `app_config` via the DOM dashboard, refresh the SUB's page, and verify the navigation items appear/disappear accordingly.
