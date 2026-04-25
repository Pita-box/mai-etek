# SuperAdmin (DOM) & Submissive (SUB) Application Architecture

## Overview

This document outlines the requirements and architectural solutions for a system managing SuperAdmin (DOM) and Submissive (SUB) users. The core functionality revolves around a DOM claiming SUBs, having visibility into their exact registration passwords, and dynamically controlling their access to various application sections.

## Core Requirements (Czech Use Case)

1.  **Global User Visibility:** The SuperAdmin (DOM) must see a comprehensive list of ALL registered users in the system.
2.  **Plain-Text Password Reveal:** The SuperAdmin must be able to click an "eye icon" to reveal the exact, plain-text password the user entered during registration.
3.  **Claiming Mechanism:** The SuperAdmin can click a button to "Claim" a specific user, assigning them as their SUB.
4.  **Application Unlock:** Once a user is claimed by a DOM, the application unlocks for that SUB (they are likely restricted prior to being claimed).
5.  **Dynamic Section Visibility:** The SuperAdmin can dynamically configure which specific sections of the app (e.g., chat, tasks, gallery) are visible and unlocked for their claimed SUB.

## Architectural & Security Solutions

### 1. The "Plain-Text Password" Challenge

Standard Supabase Auth hashes passwords using bcrypt, making retrieval of the original password impossible. To satisfy the requirement of the DOM viewing the exact chosen password, we must intercept it.

**Proposed Solution: Symmetric Encryption Intercept**

Since storing raw plain-text is a severe security risk, we will use symmetric encryption.

*   **Custom Registration Flow:** Instead of calling Supabase `signUp` directly from the client, the client sends the email and raw password to a secure backend endpoint (e.g., a Supabase Edge Function).
*   **Dual Storage (The Intercept):**
    1.  The Edge Function calls the Supabase Admin API to create the user account (Supabase handles the bcrypt hashing for actual login).
    2.  Simultaneously, the Edge Function encrypts the raw password using a strong symmetric key (managed via environment variables/secrets).
    3.  The encrypted password, along with the user's ID, is stored in a custom, highly restricted table (e.g., `public.user_vault`).
*   **Retrieval:** When the DOM clicks the "eye icon", a request is sent to an Edge Function. This function verifies the DOM's authorization, decrypts the password from `public.user_vault`, and returns it to the DOM's frontend.
*   **Important Caveat:** If a user resets their password via a standard "Forgot Password" link that doesn't go through our custom intercept, the DOM will lose visibility of the new password. Any password reset flow must also be custom-built to intercept and update the `user_vault`.

### 2. User Claiming & Role Management

We need a structured way to handle the DOM/SUB relationship and the "unlocking" of the app.

*   **`profiles` Table:** We need a central table linking to `auth.users`. It should include fields like:
    *   `id` (UUID, references `auth.users`)
    *   `role` (Enum: 'unassigned', 'sub', 'dom')
    *   `dom_id` (UUID, nullable, references `profiles.id`) - Represents who claimed them.
*   **The Claiming Action:** When the DOM clicks "Claim":
    1.  The SUB's `dom_id` is updated to the DOM's ID.
    2.  The SUB's `role` is updated to 'sub'.
*   **Application Unlock (RLS):** We use Row Level Security (RLS) on all application tables (messages, tasks, etc.). The policies will check if the user requesting data has a `dom_id` assigned. If `dom_id` is null, access is denied (the app remains "locked").

### 3. Dynamic Section Visibility Config

The DOM needs to control which app features the SUB can access.

**Proposed Solution: JSON Configuration**

*   We add a JSONB column to the `profiles` table (or a dedicated `sub_settings` table linked to the SUB) called `app_config`.
*   **Structure:** This column will hold a JSON object representing the state of different modules.
    ```json
    {
      "chat": { "enabled": true },
      "tasks": { "enabled": false },
      "gallery": { "enabled": true }
    }
    ```
*   **DOM Configuration:** The DOM's dashboard provides UI toggles for these sections. Toggling them updates this JSONB column via the Supabase API.
*   **SUB Experience:** When the SUB logs in, the frontend fetches their `app_config` from their profile. The UI uses this JSON object to conditionally render navigation links and application sections. If `"tasks": { "enabled": false }`, the Tasks tab is completely hidden from the SUB's view.

## Action Plan Summary

1.  **Database:** Create `profiles` (with `role`, `dom_id`, `app_config` JSONB) and `user_vault` (for encrypted passwords). Set up strict RLS.
2.  **Edge Functions:** Build secure endpoints for custom registration (intercepting password) and password decryption for the DOM.
3.  **Frontend (DOM):** Build lists to see all users, the "Claim" button logic, the "reveal password" action, and the UI to edit the SUB's `app_config` JSON.
4.  **Frontend (SUB):** Implement logic to read `app_config` and dynamically show/hide application sections, and handle the "locked" state if unassigned.