# Layout & Navigation Implementation Plan

This plan outlines the steps to implement the basic Layout, Sidebar, Top Header, and base structure for the main application routes in the Next.js frontend (`apps/web`), adhering to the `ARCHITECTURE.md`.

## 1. Directory Structure Setup
We need to create the `(dashboard)` route group and the necessary folders for the main application features.

*   Create folder `apps/web/src/app/(dashboard)`.
*   Inside `(dashboard)`, create the following folders with empty `page.tsx` files (displaying a simple placeholder):
    *   `chat`
    *   `tasks`
    *   `gallery`
    *   `wishes`
    *   `monitoring` (with subfolders: `history`, `keylogs`, `recordings`, `live`)
    *   `rewards`
    *   `achievements`
    *   `punishments`
    *   `settings`
*   Create a `layout.tsx` inside `(dashboard)` to serve as the wrapper for all these routes.

## 2. Components Structure
Create the folders for the shared layout components.

*   Create `apps/web/src/components/shared`.
*   Inside `shared`, we will create the following components:
    *   `Navigation.tsx` (Sidebar for desktop, bottom/drawer nav for mobile).
    *   `Header.tsx` (Top header with user profile, safe word toggle, panic button placeholder).

## 3. Implement Navigation Component (`Navigation.tsx`)
This component needs to handle routing and visual active states.

*   Define navigation items with icons (using `lucide-react`) and routes.
*   Implement a responsive design:
    *   **Desktop:** A fixed sidebar on the left.
    *   **Mobile:** A bottom navigation bar or a hamburger menu + drawer. Given the "mobile-first" requirement in architecture, a bottom nav for core routes + drawer for secondary might be best, but a responsive sidebar/drawer is a good starting point.
*   Use `next/link` for routing and `usePathname` from `next/navigation` to highlight the active route.
*   Integrate `shadcn/ui` components if necessary (e.g., buttons, sheet for mobile drawer).

## 4. Implement Header Component (`Header.tsx`)
The top bar of the application.

*   Display the current page title (derived from the route or passed as a prop).
*   Add a placeholder for the User Avatar / Profile Dropdown on the right.
*   Add a placeholder button for the "Safe Word" and "Panic Button" (these will be fully implemented later).
*   Ensure it's fixed at the top or scrolls with the content appropriately.

## 5. Implement Dashboard Layout (`(dashboard)/layout.tsx`)
Combine the navigation, header, and main content area.

*   Set up a CSS Grid or Flexbox layout.
*   Left side (desktop): `<Navigation />`.
*   Right side (desktop): A vertical flex container containing the `<Header />` and a `<main>` tag for the `children`.
*   Ensure the layout takes full height (`h-screen`) and the `<main>` area is scrollable.
*   Implement basic authentication check: redirect to `/login` if no user session exists (using Supabase auth client). *Note: We'll implement a basic client-side redirect first, and can refine with middleware later if needed.*

## 6. Route Redirection
*   Update `apps/web/src/app/page.tsx` (the root page) to redirect authenticated users to the dashboard (e.g., `/tasks` or `/chat`) and unauthenticated users to `/login`.

## 7. Refine UI with shadcn/ui
*   Ensure necessary `shadcn/ui` components are installed (e.g., `button`, `sheet` for mobile nav, `dropdown-menu` for profile, `avatar`). Use the `design-system` package if available, otherwise install them in `apps/web`.

## Step-by-Step Execution Plan:

1.  **Scaffold Routes:** Create the `(dashboard)` folder structure and placeholder `page.tsx` files.
2.  **Scaffold Layout:** Create `(dashboard)/layout.tsx`.
3.  **Install Icons:** Run `pnpm add lucide-react` in `apps/web` if not already installed.
4.  **Build Components:**
    *   Create `Navigation.tsx`.
    *   Create `Header.tsx`.
5.  **Integrate Layout:** Update `(dashboard)/layout.tsx` to use the new components.
6.  **Auth Guard:** Add client-side auth check to the layout to protect the routes.
7.  **Root Redirect:** Update `app/page.tsx` to handle the initial redirect.
