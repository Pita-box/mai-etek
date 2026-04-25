# Tasks (Úkoly) Module Implementation Plan

## 1. Overview
The Tasks module allows the DOM to assign tasks to the SUB, set deadlines, points, and recurrence. The SUB views tasks, uploads evidence, and submits them for approval. The DOM then approves (with rating and feedback) or rejects the task (with comments). The system handles task expiry and auto-assigns punishments or manually assigned punishments by the DOM - SuperAdmin.

## 2. Database Schema (Existing verification)
The `tasks` and `task_evidence` tables already exist in `database/migrations/001_initial_schema.sql` with necessary fields (status, priority, points, deadline, recurrence, rating, etc.). We will use Supabase for CRUD operations. No new DB schema changes are required at this stage.

## 3. Backend API Routes (`apps/web/src/app/api/tasks`)
Since we are using Next.js App Router and Supabase, we will implement API routes for complex operations (like task submission, approval, and rejection which might trigger other actions) and use direct Supabase queries in Server Components/Actions for simple data fetching.

*   **`GET /api/tasks`**: List tasks with filtering (status, priority, date).
*   **`POST /api/tasks`**: Create a new task (DOM only).
*   **`GET /api/tasks/[id]`**: Get task details and evidence.
*   **`PUT /api/tasks/[id]`**: Update a task (DOM only).
*   **`DELETE /api/tasks/[id]`**: Delete a task (DOM only).
*   **`POST /api/tasks/[id]/submit`**: SUB submits a task with evidence. Updates status to `in_review`.
*   **`POST /api/tasks/[id]/approve`**: DOM approves task. Sets rating, feedback, points. Status to `completed`.
*   **`POST /api/tasks/[id]/reject`**: DOM rejects task. Status to `rejected`. (Triggers punishment logic later).

## 4. Frontend Implementation (`apps/web/src/app/(dashboard)/tasks`)

### 4.1. Shared Components
*   `TaskCard.tsx`: Displays summary of a task (title, priority badge, status, deadline countdown).
*   `TaskStatusBadge.tsx`: Visual badge for 'pending', 'in_progress', 'in_review', 'completed', 'rejected', 'expired'.
*   `PriorityBadge.tsx`: Visual badge for 'low', 'medium', 'high', 'urgent'.

### 4.2. DOM Views (Superadmin)
*   **`app/(dashboard)/tasks/page.tsx`**:
    *   List all tasks with filters (tabs for Active, In Review, Completed).
    *   "Vytvořit úkol" (Create Task) button.
*   **`app/(dashboard)/tasks/new/page.tsx`**:
    *   Form to create a task: Title, Description (markdown support), Priority, Points Reward, Deadline, Recurrence.
*   **`app/(dashboard)/tasks/[id]/page.tsx`**:
    *   Detailed view.
    *   If status is `in_review`: Show SUB's evidence. Buttons to "Schválit" (Approve) or "Zamítnout" (Reject).
    *   Approve modal: Add rating (1-5 stars) and feedback.

### 4.3. SUB Views (User)
*   **`app/(dashboard)/tasks/page.tsx`**:
    *   List tasks. Focused on "To Do" and "Active".
*   **`app/(dashboard)/tasks/[id]/page.tsx`**:
    *   Detailed view of instructions.
    *   Button to "Začít úkol" (Start Task) -> changes status to `in_progress`.
    *   If `in_progress`: `EvidenceUpload.tsx` component to add text, image, or video evidence.
    *   "Odeslat ke kontrole" (Submit for Review) button.

## 5. Background Jobs (Later Phase)
*   *Task Expiry Worker*: Cron job to check for tasks past deadline and mark them 'expired', auto-assigning punishments.
*   *Recurring Task Generator*: Cron job to spawn daily/weekly tasks from templates.

## 6. Implementation Steps
1.  **API & Actions**: Create Next.js Server Actions for Task CRUD and state transitions (submit, approve, reject).
2.  **UI Components**: Build `TaskCard`, `TaskForm` (using `react-hook-form` & `zod`), `EvidenceUpload`.
3.  **Pages**: Implement the DOM and SUB views for the task list and task details.
4.  **Integration**: Connect frontend forms to Server Actions, handle loading states and error toasts.

*(Language Note: All UI text will be in Czech as per project requirements).*