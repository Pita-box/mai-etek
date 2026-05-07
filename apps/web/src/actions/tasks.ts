"use server";

import { createActivityNotification } from "@/actions/notifications";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { uploadTaskFileToDrive } from "@/lib/google-drive/tasks";
import {
  sendTaskCommentNotification,
  sendTaskSubmittedNotification,
} from "@/lib/telegram/notifications";
import { getPublicTaskId, getTaskHref, getTaskIdColumn } from "@/lib/tasks/ids";
import {
  getTaskMediaSizeError,
  TASK_MEDIA_MAX_BYTES,
} from "@/lib/tasks/media-limits";
import { revalidatePath } from "next/cache";

function isMissingRelationError(
  error: { code?: string; message?: string } | null,
) {
  return Boolean(
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.message?.toLowerCase().includes("schema cache") ||
    error?.message?.toLowerCase().includes("does not exist"),
  );
}

function revalidateTaskPaths(task: {
  id: string;
  public_task_id?: string | null;
}) {
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${task.id}`);
  revalidatePath(getTaskHref(task));
}

function parseNonNegativeInteger(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseOptionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function getTaskAutomationFields(formData: FormData) {
  const deadline = (formData.get("deadline") as string) || null;
  const recurrence = (formData.get("recurrence") as string) || "none";

  if (recurrence !== "none" && !deadline) {
    return {
      error: "Opakovaný úkol potřebuje termín splnění.",
      fields: null,
    };
  }

  return {
    error: null,
    fields: {
      deadline,
      recurrence,
      expiry_penalty_points: parseNonNegativeInteger(
        formData.get("expiry_penalty_points"),
      ),
      expiry_penalty_reason: parseOptionalText(
        formData.get("expiry_penalty_reason"),
      ),
    },
  };
}

const taskSubmissionStatuses = new Set([
  "pending",
  "in_progress",
  "revision_requested",
]);

function canChangeTaskSubmission(status: string | null | undefined) {
  return taskSubmissionStatuses.has(status || "");
}

function isRecurringTaskTemplate(task: {
  recurrence?: string | null;
  parent_task_id?: string | null;
}) {
  return Boolean(
    task.recurrence && task.recurrence !== "none" && !task.parent_task_id,
  );
}

type TaskAttemptRow = {
  id: string;
  task_id: string;
  submitted_by: string;
  attempt_number: number;
  text_content: string | null;
  status: "draft" | "submitted" | "approved" | "revision_requested";
  submitted_at: string | null;
};

type TaskViewSummaryRow = {
  task_id: string;
  last_viewed_at: string | null;
  view_count: number | null;
};

function getLatestViewSummary(rows: TaskViewSummaryRow[]) {
  return rows.reduce<TaskViewSummaryRow | null>((latest, row) => {
    if (!latest) return row;
    if (!row.last_viewed_at) return latest;
    if (!latest.last_viewed_at) return row;
    return new Date(row.last_viewed_at) > new Date(latest.last_viewed_at)
      ? row
      : latest;
  }, null);
}

async function getLatestTaskAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  submittedBy: string,
) {
  const { data, error } = await supabase
    .from("task_attempts")
    .select(
      "id, task_id, submitted_by, attempt_number, text_content, status, submitted_at",
    )
    .eq("task_id", taskId)
    .eq("submitted_by", submittedBy)
    .order("attempt_number", { ascending: false })
    .limit(1);

  if (error && !isMissingRelationError(error)) {
    console.error("Error loading latest task attempt:", error);
    return { error: error.message, attempt: null };
  }

  const attempt = (data?.[0] as TaskAttemptRow | undefined) ?? null;
  return { error: null, attempt };
}

async function ensureDraftTaskAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  submittedBy: string,
) {
  const latestAttemptResult = await getLatestTaskAttempt(
    supabase,
    taskId,
    submittedBy,
  );

  if (latestAttemptResult.error) {
    return latestAttemptResult;
  }

  if (
    latestAttemptResult.attempt?.status === "draft" ||
    latestAttemptResult.attempt?.status === "revision_requested"
  ) {
    return latestAttemptResult;
  }

  const nextAttemptNumber =
    (latestAttemptResult.attempt?.attempt_number || 0) + 1;
  const { data, error } = await supabase
    .from("task_attempts")
    .insert({
      task_id: taskId,
      submitted_by: submittedBy,
      attempt_number: nextAttemptNumber,
      status: "draft",
    })
    .select(
      "id, task_id, submitted_by, attempt_number, text_content, status, submitted_at",
    );

  if (error && !isMissingRelationError(error)) {
    console.error("Error creating draft task attempt:", error);
    return { error: error.message, attempt: null };
  }

  const attempt = (data?.[0] as TaskAttemptRow | undefined) ?? null;
  return { error: null, attempt };
}

export async function getTasks() {
  const supabase = await createClient();
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }

  const taskList = tasks || [];
  const taskIds = taskList.map((task) => task.id);

  if (taskIds.length === 0) {
    return [];
  }

  const [attemptsResult, evidenceResult, mediaResult, viewSummaryResult] =
    await Promise.all([
      supabase
        .from("task_attempts")
        .select("*")
        .in("task_id", taskIds)
        .order("attempt_number", { ascending: false }),
      supabase.from("task_evidence").select("*").in("task_id", taskIds),
      supabase
        .from("task_media")
        .select("*")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("task_view_summary")
        .select("task_id, last_viewed_at, view_count")
        .in("task_id", taskIds),
    ]);

  const attempts =
    attemptsResult.error && !isMissingRelationError(attemptsResult.error)
      ? []
      : attemptsResult.data || [];
  const evidence =
    evidenceResult.error && !isMissingRelationError(evidenceResult.error)
      ? []
      : evidenceResult.data || [];
  const media =
    mediaResult.error && !isMissingRelationError(mediaResult.error)
      ? []
      : mediaResult.data || [];
  const viewSummaries =
    viewSummaryResult.error && !isMissingRelationError(viewSummaryResult.error)
      ? []
      : ((viewSummaryResult.data || []) as TaskViewSummaryRow[]);

  const attemptsByTask = new Map<string, typeof attempts>();
  const evidenceByTask = new Map<string, typeof evidence>();
  const mediaByTask = new Map<string, typeof media>();
  const viewSummaryByTask = new Map<string, TaskViewSummaryRow>();

  for (const attempt of attempts) {
    const taskAttempts = attemptsByTask.get(attempt.task_id) || [];
    taskAttempts.push(attempt);
    attemptsByTask.set(attempt.task_id, taskAttempts);
  }

  for (const item of evidence) {
    const taskEvidence = evidenceByTask.get(item.task_id) || [];
    taskEvidence.push(item);
    evidenceByTask.set(item.task_id, taskEvidence);
  }

  for (const item of media) {
    const taskMedia = mediaByTask.get(item.task_id) || [];
    taskMedia.push(item);
    mediaByTask.set(item.task_id, taskMedia);
  }

  for (const summary of viewSummaries) {
    const existing = viewSummaryByTask.get(summary.task_id);
    const latest = getLatestViewSummary(
      existing ? [existing, summary] : [summary],
    );
    if (latest) viewSummaryByTask.set(summary.task_id, latest);
  }

  return taskList.map((task) => {
    const viewSummary = viewSummaryByTask.get(task.id);

    return {
      ...task,
      public_task_id: getPublicTaskId(task),
      last_viewed_at: viewSummary?.last_viewed_at ?? null,
      view_count: viewSummary?.view_count ?? null,
      task_attempts: attemptsByTask.get(task.id) || [],
      task_evidence: evidenceByTask.get(task.id) || [],
      task_media: mediaByTask.get(task.id) || [],
    };
  });
}

export async function getTask(id: string) {
  const supabase = await createClient();

  if (!id) {
    console.error("Error: getTask called without id");
    return null;
  }

  const taskIdColumn = getTaskIdColumn(id);

  // Fallback pattern: first get task, then get evidence to avoid RLS/relationship issues
  // with joined tables if they aren't perfectly configured
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq(taskIdColumn, id)
    .single();

  if (taskError) {
    console.error("Error fetching task:", taskError);
    return null;
  }

  if (!task) return null;

  const publicTaskId = getPublicTaskId(task);

  // Try to fetch evidence separately
  const { data: evidence } = await supabase
    .from("task_evidence")
    .select("*")
    .eq("task_id", task.id);

  const { data: attempts, error: attemptsError } = await supabase
    .from("task_attempts")
    .select("*")
    .eq("task_id", task.id)
    .order("attempt_number", { ascending: false });

  const { data: media, error: mediaError } = await supabase
    .from("task_media")
    .select("*")
    .eq("task_id", task.id)
    .order("created_at", { ascending: false });

  const { data: viewSummaries, error: viewSummaryError } = await supabase
    .from("task_view_summary")
    .select("task_id, last_viewed_at, view_count")
    .eq("task_id", task.id);

  const viewSummary =
    viewSummaryError && !isMissingRelationError(viewSummaryError)
      ? null
      : getLatestViewSummary((viewSummaries || []) as TaskViewSummaryRow[]);

  return {
    ...task,
    public_task_id: publicTaskId,
    last_viewed_at: viewSummary?.last_viewed_at ?? null,
    view_count: viewSummary?.view_count ?? null,
    task_attempts:
      attemptsError && !isMissingRelationError(attemptsError)
        ? []
        : attempts || [],
    task_media:
      mediaError && !isMissingRelationError(mediaError) ? [] : media || [],
    task_evidence: evidence || [],
  };
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();

  // Get current user profile
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Determine assigned_by and assigned_to based on role
  const assigned_by = session.user.id;
  let assigned_to = formData.get("assigned_to") as string;

  if (!assigned_to) {
    // If no assigned_to provided, and user is DOM, assign to their SUB
    // For now we just get the first SUB assigned to this DOM
    const { data: subProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("dom_id", session.user.id)
      .single();

    if (subProfile) {
      assigned_to = subProfile.id;
    } else {
      return { error: "No sub assigned to this dom" };
    }
  }

  const automation = getTaskAutomationFields(formData);
  if (automation.error || !automation.fields) {
    return { error: automation.error || "Úkol se nepodařilo připravit." };
  }

  // TODO: validate input with zod
  const task = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    priority: formData.get("priority") as string,
    points_reward: parseNonNegativeInteger(formData.get("points_reward")),
    ...automation.fields,
    recurrence_config: {},
    status: "in_progress",
    assigned_by,
    assigned_to,
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();

  if (error) {
    if (error?.message?.includes("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error creating task:", error);
    return { error: error.message };
  }

  await createActivityNotification({
    recipientId: assigned_to,
    pageKey: "tasks",
    entityType: "task",
    entityId: data.id,
    taskId: data.id,
    title: "Nový úkol",
    body: `DOM přidal nový úkol: ${task.title}`,
    type: "task_created",
  });

  revalidatePath("/tasks");
  return { data };
}

export async function updateTask(id: string, formData: FormData) {
  const supabase = await createClient();
  const automation = getTaskAutomationFields(formData);
  if (automation.error || !automation.fields) {
    return { error: automation.error || "Úkol se nepodařilo připravit." };
  }

  // TODO: validate input with zod
  const updates = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    priority: formData.get("priority") as string,
    points_reward: parseNonNegativeInteger(formData.get("points_reward")),
    ...automation.fields,
  };

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating task:", error);
    return { error: error.message };
  }

  revalidateTaskPaths(data);
  return { data };
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, assigned_by, public_task_id")
    .eq("id", id)
    .single();

  if (taskError || !task) {
    console.error("Error fetching task for delete:", taskError);
    return { error: taskError?.message || "Task not found" };
  }

  if (task.assigned_by !== session.user.id) {
    return { error: "Forbidden" };
  }

  const admin = createAdminClient();
  const { data: taskComments, error: taskCommentsError } = await admin
    .from("task_comments")
    .select("id")
    .eq("task_id", id);

  if (taskCommentsError && !isMissingRelationError(taskCommentsError)) {
    console.error("Error loading task comments for delete:", taskCommentsError);
    return { error: taskCommentsError.message };
  }

  const commentIds = (taskComments || []).map((comment) => comment.id);

  if (commentIds.length > 0) {
    const { error: likesDeleteError } = await admin
      .from("task_comment_likes")
      .delete()
      .in("comment_id", commentIds);

    if (likesDeleteError && !isMissingRelationError(likesDeleteError)) {
      console.error("Error deleting task comment likes:", likesDeleteError);
      return { error: likesDeleteError.message };
    }
  }

  const cleanupSteps = [
    () => admin.from("notifications").delete().eq("task_id", id),
    () => admin.from("task_view_summary").delete().eq("task_id", id),
    () => admin.from("task_user_visibility").delete().eq("task_id", id),
    () => admin.from("task_evidence").delete().eq("task_id", id),
    () => admin.from("task_media").delete().eq("task_id", id),
    () => admin.from("task_comments").delete().eq("task_id", id),
    () => admin.from("task_attempts").delete().eq("task_id", id),
  ];

  for (const cleanupStep of cleanupSteps) {
    const { error: cleanupError } = await cleanupStep();

    if (cleanupError && !isMissingRelationError(cleanupError)) {
      console.error("Error cleaning up related task rows:", cleanupError);
      return { error: cleanupError.message };
    }
  }

  const { data: deletedRows, error } = await admin
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Error deleting task:", error);
    return { error: error.message };
  }

  if (!deletedRows?.length) {
    return { error: "Úkol se nepodařilo odstranit z databáze." };
  }

  revalidateTaskPaths(task);
  revalidatePath("/tasks");
  return { success: true };
}

export async function startTask(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error starting task:", error);
    return { error: error.message };
  }

  revalidateTaskPaths(data);
  return { data };
}

export async function saveTaskTextEvidence(id: string, text: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: taskRows, error: taskLookupError } = await supabase
    .from("tasks")
    .select(
      "id, assigned_to, assigned_by, title, public_task_id, status, recurrence, parent_task_id",
    )
    .eq("id", id)
    .limit(1);

  const task = taskRows?.[0] ?? null;

  if (taskLookupError || !task) {
    console.error(
      "Error loading task before saving text evidence:",
      taskLookupError,
    );
    return { error: taskLookupError?.message || "Task not found" };
  }

  if (task.assigned_to !== session.user.id) {
    return { error: "Unauthorized" };
  }

  if (!canChangeTaskSubmission(task.status) || isRecurringTaskTemplate(task)) {
    return { error: "Tento úkol už nejde upravovat." };
  }

  const draftAttemptResult = await ensureDraftTaskAttempt(
    supabase,
    id,
    session.user.id,
  );

  if (draftAttemptResult.error || !draftAttemptResult.attempt) {
    return {
      error: draftAttemptResult.error || "Unable to prepare task draft",
    };
  }

  const normalizedText = text.trim();
  const { data: updatedAttempts, error: updateError } = await supabase
    .from("task_attempts")
    .update({
      text_content: normalizedText || null,
    })
    .eq("id", draftAttemptResult.attempt.id)
    .select();

  const attempt = updatedAttempts?.[0] ?? null;

  if (updateError) {
    console.error("Error saving task text evidence:", updateError);
    return { error: updateError.message };
  }

  if (!attempt) {
    return { error: "Textové odevzdání se nepodařilo uložit." };
  }

  if (normalizedText) {
    await createActivityNotification({
      recipientId: task.assigned_by,
      pageKey: "tasks",
      entityType: "task",
      entityId: id,
      taskId: id,
      title: `Úkol: ${task.title || "Odevzdání"}`,
      body: "Subíček upravil textové odevzdání.",
      type: "task_text_evidence",
      dedupeKey: `task_text_evidence:${id}:${attempt.id}`,
    });
  }

  revalidateTaskPaths(task);
  return { success: true, attempt };
}

export async function submitTask(
  id: string,
  evidenceData: { text?: string; imageUrl?: string; videoUrl?: string },
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: task, error: taskLookupError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (taskLookupError || !task) {
    console.error("Error loading task before submit:", taskLookupError);
    return { error: taskLookupError?.message || "Task not found" };
  }

  if (task.assigned_to !== session.user.id) {
    return { error: "Unauthorized" };
  }

  if (!canChangeTaskSubmission(task.status) || isRecurringTaskTemplate(task)) {
    return { error: "Tento úkol už nejde odevzdat." };
  }

  const providedText = evidenceData.text?.trim() || "";
  const draftAttemptResult = await ensureDraftTaskAttempt(
    supabase,
    id,
    session.user.id,
  );

  if (draftAttemptResult.error) {
    return { error: draftAttemptResult.error };
  }

  const draftAttempt = draftAttemptResult.attempt;
  const textContent = providedText || draftAttempt?.text_content?.trim() || "";

  const [{ count: mediaCount }, { count: legacyEvidenceCount }] =
    await Promise.all([
      supabase
        .from("task_media")
        .select("id", { count: "exact", head: true })
        .eq("task_id", id),
      supabase
        .from("task_evidence")
        .select("id", { count: "exact", head: true })
        .eq("task_id", id)
        .in("type", ["image", "video"]),
    ]);

  const hasAnyEvidence = Boolean(
    textContent ||
    evidenceData.imageUrl ||
    evidenceData.videoUrl ||
    (mediaCount || 0) > 0 ||
    (legacyEvidenceCount || 0) > 0,
  );

  if (!hasAnyEvidence) {
    return {
      error:
        "Pro odevzdání úkolu je potřeba přidat textové nebo mediální odevzdání.",
    };
  }

  const isResubmission =
    task.status === "revision_requested" ||
    draftAttempt?.status === "revision_requested";
  let attempt = draftAttempt;

  if (
    draftAttempt?.status === "draft" ||
    draftAttempt?.status === "revision_requested"
  ) {
    const { data: updatedAttempt, error: attemptUpdateError } = await supabase
      .from("task_attempts")
      .update({
        text_content: textContent || null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", draftAttempt.id)
      .select()
      .single();

    if (attemptUpdateError && !isMissingRelationError(attemptUpdateError)) {
      console.error(
        "Error updating task attempt during submit:",
        attemptUpdateError,
      );
      return { error: attemptUpdateError.message };
    }

    attempt = updatedAttempt ?? draftAttempt;
  } else {
    const { count } = await supabase
      .from("task_attempts")
      .select("id", { count: "exact", head: true })
      .eq("task_id", id);

    const attemptNumber = (count || 0) + 1;
    const { data: createdAttempt, error: attemptError } = await supabase
      .from("task_attempts")
      .insert({
        task_id: id,
        submitted_by: session.user.id,
        attempt_number: attemptNumber,
        text_content: textContent || null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError && !isMissingRelationError(attemptError)) {
      console.error("Error creating task attempt:", attemptError);
      return { error: attemptError.message };
    }

    attempt = createdAttempt ?? null;
  }

  const { data, error: taskError } = await supabase
    .from("tasks")
    .update({ status: "in_review" })
    .eq("id", id)
    .select()
    .single();

  if (taskError) {
    console.error("Error submitting task:", taskError);
    return { error: taskError.message };
  }

  if (providedText || evidenceData.imageUrl || evidenceData.videoUrl) {
    let type = "text";
    let content = providedText;
    if (evidenceData.imageUrl) {
      type = "image";
      content = evidenceData.imageUrl;
    } else if (evidenceData.videoUrl) {
      type = "video";
      content = evidenceData.videoUrl;
    }
    if (content) {
      const { error: evidenceError } = await supabase
        .from("task_evidence")
        .insert({
          task_id: id,
          type,
          content,
        });
      if (evidenceError) {
        console.error("Error adding task evidence:", evidenceError);
        return { error: evidenceError.message };
      }
    }
  }

  await createActivityNotification({
    recipientId: task.assigned_by,
    pageKey: "tasks",
    entityType: "task",
    entityId: id,
    taskId: id,
    title: `Úkol: ${task.title}`,
    body: "Subíček odevzdal tento task úkol.",
    type: "task_submitted",
  });

  const submitter = await getViewerCommentContext(supabase, session.user.id);
  await sendTaskSubmittedNotification({
    taskId: getPublicTaskId(data || task),
    taskTitle: task.title,
    actorName: submitter.fullName,
    isResubmission,
  });

  revalidateTaskPaths(data || task);
  return { success: true, attempt };
}

export async function approveTask(id: string, formData: FormData) {
  const supabase = await createClient();
  const rating = parseInt(formData.get("rating") as string) || 0;
  const feedback = formData.get("feedback") as string;

  const { data: existingTask, error: lookupError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (lookupError || !existingTask) {
    console.error("Error loading task before approve:", lookupError);
    return { error: lookupError?.message || "Task not found" };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      rating,
      dom_feedback: feedback,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error approving task:", error);
    return { error: error.message };
  }

  const { error: awardError } = await supabase.rpc("award_task_xp", {
    task_uuid: id,
  });

  if (awardError) {
    console.error("Error awarding task XP:", awardError);
    return { error: awardError.message };
  }

  await createActivityNotification({
    recipientId: existingTask.assigned_to,
    pageKey: "tasks",
    entityType: "task",
    entityId: id,
    taskId: id,
    title: "DOM schválil úkol",
    body:
      feedback ||
      `Získal jsi ${existingTask.points_reward || 0} XP za uspokojení alfa samečka. Jen tak dál, subíčku!`,
    type: "task_approved",
  });

  revalidateTaskPaths(data);
  return { data };
}

export async function rejectTask(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const feedback = formData.get("feedback") as string;
  const disciplinePoints =
    parseInt(String(formData.get("discipline_points") || ""), 10) || 0;
  const disciplineReason =
    (formData.get("discipline_reason") as string | null)?.trim() || feedback;

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: "revision_requested",
      dom_feedback: feedback,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error rejecting task:", error);
    return { error: error.message };
  }

  await supabase
    .from("task_attempts")
    .update({
      status: "revision_requested",
      reviewed_by: session?.user.id,
      reviewed_at: new Date().toISOString(),
      review_feedback: feedback,
    })
    .eq("task_id", id)
    .eq("status", "submitted");

  if (task) {
    if (disciplinePoints > 0) {
      const { error: disciplineError } = await supabase.rpc(
        "apply_manual_discipline",
        {
          target_user_id: task.assigned_to,
          points: disciplinePoints,
          reason: `Odmítnutý úkol: ${task.title || "Úkol"}. ${disciplineReason}`,
          source_type: "task_rejection_penalty",
          source_id: id,
        },
      );

      if (disciplineError) {
        console.error("Error applying rejection discipline:", disciplineError);
        return {
          error: `Úkol byl odmítnut, ale kázeňská penalizace se nepodařila uložit: ${disciplineError.message}`,
        };
      }
    }

    await createActivityNotification({
      recipientId: task.assigned_to,
      pageKey: "tasks",
      entityType: "task",
      entityId: id,
      taskId: id,
      title: "DOM odmítl úkol",
      body:
        feedback ||
        "Úkol potřebuje opravu. Zkontroluj zpětnou vazbu a odešli ho znovu.",
      type: "task_revision_requested",
    });
  }

  revalidateTaskPaths(data);
  return { data };
}

type TaskCommentRow = {
  id: string;
  task_id: string;
  author_id: string;
  tab_type: "text" | "photos" | "videos";
  body: string;
  created_at: string;
  updated_at: string;
};

type TaskCommentRole = "dom" | "sub" | "unassigned";

type TaskCommentProfile = {
  id: string;
  full_name: string | null;
  role?: TaskCommentRole | null;
};

type TaskCommentLikeRow = {
  comment_id: string;
  user_id: string;
};

type TaskCommentPayload = TaskCommentRow & {
  author_name: string;
  author_role: TaskCommentRole;
  can_edit: boolean;
  can_delete: boolean;
  liked_by_me: boolean;
  like_count: number;
  is_edited: boolean;
};

type ViewerCommentContext = {
  userId: string;
  role: TaskCommentRole;
  fullName: string;
};

function normalizeProfileName(fullName: string | null | undefined) {
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : "subíček";
}

async function getViewerCommentContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ViewerCommentContext> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error && !isMissingRelationError(error)) {
    console.error("Error fetching viewer comment context:", error);
  }

  return {
    userId,
    role:
      profile?.role === "dom"
        ? "dom"
        : profile?.role === "unassigned"
          ? "unassigned"
          : "sub",
    fullName: normalizeProfileName(profile?.full_name),
  };
}

async function getTaskCommentProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorIds: string[],
) {
  const profilesById = new Map<string, TaskCommentProfile>();

  if (authorIds.length === 0) {
    return profilesById;
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", authorIds);

  if (error) {
    if (!isMissingRelationError(error)) {
      console.error("Error fetching task comment authors:", error);
    }

    const fallback = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);

    if (fallback.error) {
      if (!isMissingRelationError(fallback.error)) {
        console.error(
          "Error fetching fallback task comment authors:",
          fallback.error,
        );
      }
      return profilesById;
    }

    fallback.data?.forEach((profile) => {
      profilesById.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name,
        role: "sub",
      });
    });
    return profilesById;
  }

  profiles?.forEach((profile) => {
    profilesById.set(profile.id, profile as TaskCommentProfile);
  });

  return profilesById;
}

async function getTaskCommentLikes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  commentIds: string[],
) {
  const likesByCommentId = new Map<string, Set<string>>();

  if (commentIds.length === 0) {
    return likesByCommentId;
  }

  const { data: likes, error } = await supabase
    .from("task_comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) {
    if (!isMissingRelationError(error)) {
      console.error("Error fetching task comment likes:", error);
    }
    return likesByCommentId;
  }

  (likes as TaskCommentLikeRow[] | null)?.forEach((like) => {
    const existing = likesByCommentId.get(like.comment_id) || new Set<string>();
    existing.add(like.user_id);
    likesByCommentId.set(like.comment_id, existing);
  });

  return likesByCommentId;
}

async function enrichTaskComments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comments: TaskCommentRow[],
  viewer: ViewerCommentContext,
): Promise<TaskCommentPayload[]> {
  const authorIds = Array.from(
    new Set(comments.map((comment) => comment.author_id)),
  );
  const commentIds = comments.map((comment) => comment.id);
  const [profilesById, likesByCommentId] = await Promise.all([
    getTaskCommentProfiles(supabase, authorIds),
    getTaskCommentLikes(supabase, commentIds),
  ]);

  return comments.map((comment) => {
    const author = profilesById.get(comment.author_id);
    const likes = likesByCommentId.get(comment.id) || new Set<string>();
    const authorRole =
      author?.role === "dom"
        ? "dom"
        : author?.role === "unassigned"
          ? "unassigned"
          : comment.author_id === viewer.userId
            ? viewer.role
            : "sub";

    return {
      ...comment,
      author_name: normalizeProfileName(author?.full_name),
      author_role: authorRole,
      can_edit: comment.author_id === viewer.userId,
      can_delete: viewer.role === "dom",
      liked_by_me: likes.has(viewer.userId),
      like_count: likes.size,
      is_edited: comment.updated_at !== comment.created_at,
    };
  });
}

export async function getTaskComments(
  taskId: string,
  tabType: "text" | "photos" | "videos",
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated", comments: [] as TaskCommentPayload[] };
  }

  const viewer = await getViewerCommentContext(supabase, session.user.id);
  const { data, error } = await supabase
    .from("task_comments")
    .select("id, task_id, author_id, tab_type, body, created_at, updated_at")
    .eq("task_id", taskId)
    .eq("tab_type", tabType)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        error: "Komentáře budou dostupné po aplikaci databázových migrací.",
        comments: [] as TaskCommentPayload[],
      };
    }
    console.error("Error fetching task comments:", error);
    return { error: error.message, comments: [] as TaskCommentPayload[] };
  }

  const comments = (data || []) as TaskCommentRow[];
  return { comments: await enrichTaskComments(supabase, comments, viewer) };
}

export async function addTaskComment(
  taskId: string,
  tabType: "text" | "photos" | "videos",
  body: string,
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const cleanBody = body.trim();
  if (!cleanBody) {
    return { error: "Komentář nesmí být prázdný." };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return { error: taskError?.message || "Task not found" };
  }

  const { data: comment, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      author_id: session.user.id,
      tab_type: tabType,
      body: cleanBody,
    })
    .select("id, task_id, author_id, tab_type, body, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        error: "Komentáře budou dostupné po aplikaci databázových migrací.",
      };
    }
    console.error("Error adding task comment:", error);
    return { error: error.message };
  }

  const isSubActivity = session.user.id === task.assigned_to;
  const recipientId = isSubActivity ? task.assigned_by : task.assigned_to;
  await createActivityNotification({
    recipientId,
    pageKey: "tasks",
    entityType: "task",
    entityId: taskId,
    taskId,
    title: isSubActivity
      ? `Úkol: ${task.title}`
      : "DOM přidal komentář k úkolu",
    body: isSubActivity
      ? "Subíček okomentoval tento task úkol."
      : cleanBody.slice(0, 180),
    type: "task_comment",
  });

  const viewer = await getViewerCommentContext(supabase, session.user.id);
  if (isSubActivity) {
    await sendTaskCommentNotification({
      taskId: getPublicTaskId(task),
      taskTitle: task.title,
      comment: cleanBody,
      actorName: viewer.fullName,
    });
  }

  const [enrichedComment] = await enrichTaskComments(
    supabase,
    [comment as TaskCommentRow],
    viewer,
  );

  revalidateTaskPaths(task);
  return { success: true, comment: enrichedComment };
}

export async function updateTaskComment(commentId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const cleanBody = body.trim();
  if (!cleanBody) {
    return { error: "Komentář nesmí být prázdný." };
  }

  const { data: existingComment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id, author_id, deleted_at")
    .eq("id", commentId)
    .single();

  if (commentError || !existingComment) {
    return { error: commentError?.message || "Komentář nebyl nalezen." };
  }

  if (existingComment.deleted_at) {
    return { error: "Komentář už byl smazán." };
  }

  if (existingComment.author_id !== session.user.id) {
    return { error: "Upravit můžeš jen vlastní komentář." };
  }

  const { data: comment, error } = await supabase
    .from("task_comments")
    .update({ body: cleanBody })
    .eq("id", commentId)
    .select("id, task_id, author_id, tab_type, body, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        error:
          "Editace komentářů bude dostupná po aplikaci databázových migrací.",
      };
    }
    console.error("Error updating task comment:", error);
    return { error: error.message };
  }

  if (!comment) {
    return {
      error:
        "Nepodařilo se uložit úpravu (pravděpodobně chybí oprávnění nebo komentář neexistuje).",
    };
  }

  const viewer = await getViewerCommentContext(supabase, session.user.id);
  const [enrichedComment] = await enrichTaskComments(
    supabase,
    [comment as TaskCommentRow],
    viewer,
  );

  revalidateTaskPaths({ id: existingComment.task_id });
  return { success: true, comment: enrichedComment };
}

export async function deleteTaskComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const viewer = await getViewerCommentContext(supabase, session.user.id);
  if (viewer.role !== "dom") {
    return { error: "Mazat komentáře může jen SuperAdmin." };
  }

  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id, deleted_at")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) {
    return { error: commentError?.message || "Komentář nebyl nalezen." };
  }

  if (comment.deleted_at) {
    return { success: true, commentId };
  }

  const { error } = await supabase.rpc("dom_soft_delete_task_comment", {
    p_comment_id: commentId,
  });

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        error:
          "Mazání komentářů bude dostupné po aplikaci databázových migrací.",
      };
    }
    console.error("Error deleting task comment:", error);
    return { error: "Komentář se nepodařilo smazat." };
  }

  revalidateTaskPaths({ id: comment.task_id });
  return { success: true, commentId };
}

export async function toggleTaskCommentLike(commentId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .select("id, task_id, deleted_at")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) {
    return { error: commentError?.message || "Komentář nebyl nalezen." };
  }

  if (comment.deleted_at) {
    return { error: "Komentář už byl smazán." };
  }

  const { data: existingLike, error: likeLookupError } = await supabase
    .from("task_comment_likes")
    .select("comment_id, user_id")
    .eq("comment_id", commentId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (likeLookupError) {
    if (isMissingRelationError(likeLookupError)) {
      return {
        error: "Srdíčka budou dostupná po aplikaci databázových migrací.",
      };
    }
    console.error("Error loading task comment like:", likeLookupError);
    return { error: likeLookupError.message };
  }

  if (existingLike) {
    const { error: unlikeError } = await supabase
      .from("task_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", session.user.id);

    if (unlikeError) {
      console.error("Error removing task comment like:", unlikeError);
      return { error: unlikeError.message };
    }
  } else {
    const { error: likeError } = await supabase
      .from("task_comment_likes")
      .insert({
        comment_id: commentId,
        user_id: session.user.id,
      });

    if (likeError) {
      if (isMissingRelationError(likeError)) {
        return {
          error: "Srdíčka budou dostupná po aplikaci databázových migrací.",
        };
      }
      console.error("Error adding task comment like:", likeError);
      return { error: likeError.message };
    }
  }

  const likesByComment = await getTaskCommentLikes(supabase, [commentId]);
  const likes = likesByComment.get(commentId) || new Set<string>();

  revalidateTaskPaths({ id: comment.task_id });
  return {
    success: true,
    commentId,
    likedByMe: likes.has(session.user.id),
    likeCount: likes.size,
  };
}

export async function uploadTaskMedia(taskId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const file = formData.get("file");
  const mediaType = formData.get("mediaType");

  if (!(file instanceof File)) {
    return { error: "Missing file" };
  }

  if (mediaType !== "image" && mediaType !== "video") {
    return { error: "Unsupported media type" };
  }

  if (!file.type.startsWith(`${mediaType}/`)) {
    return { error: mediaType === "image" ? "Vyber obrázek." : "Vyber video." };
  }

  const maxSize = TASK_MEDIA_MAX_BYTES[mediaType];
  if (file.size > maxSize) {
    return { error: getTaskMediaSizeError(mediaType) };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return { error: taskError?.message || "Task not found" };
  }

  if (![task.assigned_by, task.assigned_to].includes(session.user.id)) {
    return { error: "Unauthorized" };
  }

  if (!canChangeTaskSubmission(task.status) || isRecurringTaskTemplate(task)) {
    return { error: "K tomuto úkolu už nejde nahrávat odevzdání." };
  }

  try {
    const uploaded = await uploadTaskFileToDrive({
      taskId,
      taskTitle: task.title,
      file,
    });
    const { error: mediaError } = await supabase.from("task_media").insert({
      task_id: taskId,
      uploaded_by: session.user.id,
      media_type: mediaType,
      original_filename: uploaded.originalFilename,
      drive_file_id: uploaded.driveFileId,
      drive_web_view_link: uploaded.driveWebViewLink,
      mime_type: uploaded.mimeType,
      size_bytes: uploaded.sizeBytes,
    });

    if (mediaError) {
      return { error: mediaError.message };
    }

    if (session.user.id === task.assigned_to) {
      await createActivityNotification({
        recipientId: task.assigned_by,
        pageKey: "tasks",
        entityType: "task",
        entityId: taskId,
        taskId,
        title: `Úkol: ${task.title}`,
        body:
          mediaType === "image"
            ? "Subíček nahrál fotku/fotky."
            : "Subíček nahrál video/videa.",
        type: "task_media_uploaded",
      });
    }

    revalidateTaskPaths(task);
    return { success: true };
  } catch (error) {
    console.error("Error uploading task media:", error);
    return { error: error instanceof Error ? error.message : "Upload failed" };
  }
}

export async function deleteTaskMedia(mediaId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Not authenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError && !isMissingRelationError(profileError)) {
    console.error("Error checking media delete permissions:", profileError);
    return { error: profileError.message };
  }

  if (profile?.role !== "dom") {
    return { error: "Forbidden" };
  }

  const { data: media, error: mediaError } = await supabase
    .from("task_media")
    .select("id, task_id, tasks(id, public_task_id)")
    .eq("id", mediaId)
    .single();

  if (mediaError || !media) {
    return { error: mediaError?.message || "Media not found" };
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("task_media")
    .delete()
    .eq("id", mediaId)
    .select("id");

  if (deleteError) {
    console.error("Error deleting task media row:", deleteError);
    return { error: deleteError.message };
  }

  if (!deletedRows?.length) {
    console.error("Task media delete reported no deleted row:", { mediaId });
    return { error: "Médium se nepodařilo odstranit z databáze." };
  }

  const task = Array.isArray(media.tasks) ? media.tasks[0] : media.tasks;
  revalidateTaskPaths(task || { id: media.task_id });
  return {
    success: true,
    deletedMediaId: deletedRows[0].id,
    taskId: media.task_id,
  };
}

export async function recordTaskView(taskId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "Not authenticated" };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, assigned_to, public_task_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return { error: taskError?.message || "Task not found" };
  }

  if (task.assigned_to !== session.user.id) {
    return { success: true, skipped: true };
  }

  const { data: existing } = await supabase
    .from("task_view_summary")
    .select("view_count")
    .eq("task_id", taskId)
    .eq("viewer_id", session.user.id)
    .maybeSingle();

  const { error } = await supabase.from("task_view_summary").upsert(
    {
      task_id: taskId,
      viewer_id: session.user.id,
      last_viewed_at: new Date().toISOString(),
      view_count: (existing?.view_count || 0) + 1,
    },
    { onConflict: "task_id,viewer_id" },
  );

  if (error) {
    if (isMissingRelationError(error)) return { success: true, skipped: true };
    console.error("Error recording task view:", error);
    return { error: error.message };
  }

  revalidateTaskPaths(task);
  return { success: true };
}
