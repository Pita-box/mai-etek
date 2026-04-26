"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  return tasks;
}

export async function getTask(id: string) {
  const supabase = await createClient();
  
  if (!id) {
    console.error("Error: getTask called without id");
    return null;
  }

  // Fallback pattern: first get task, then get evidence to avoid RLS/relationship issues 
  // with joined tables if they aren't perfectly configured
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (taskError) {
    console.error("Error fetching task:", taskError);
    return null;
  }

  if (!task) return null;

  // Try to fetch evidence separately
  const { data: evidence } = await supabase
    .from("task_evidence")
    .select("*")
    .eq("task_id", id);

  return {
    ...task,
    task_evidence: evidence || []
  };
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  
  // Get current user profile
  const { data: { session } } = await supabase.auth.getSession();
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
  let assigned_by = session.user.id;
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

  // TODO: validate input with zod
  const task = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    priority: formData.get("priority") as string,
    points_reward: parseInt(formData.get("points_reward") as string) || 0,
    deadline: formData.get("deadline") as string || null,
    status: "pending",
    assigned_by,
    assigned_to,
  };

  const { data, error } = await supabase.from("tasks").insert(task).select().single();

  if (error) {
    if (error?.message?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error("Error creating task:", error);
    return { error: error.message };
  }

  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function updateTask(id: string, formData: FormData) {
  const supabase = await createClient();
  // TODO: validate input with zod
  const updates = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    priority: formData.get("priority") as string,
    points_reward: parseInt(formData.get("points_reward") as string) || 0,
    deadline: formData.get("deadline") as string || null,
  };

  const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();

  if (error) {
    console.error("Error updating task:", error);
    return { error: error.message };
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { data };
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    console.error("Error deleting task:", error);
    return { error: error.message };
  }

  revalidatePath("/tasks");
  return { success: true };
}

export async function startTask(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("tasks").update({ status: "in_progress" }).eq("id", id).select().single();
  
    if (error) {
      console.error("Error starting task:", error);
      return { error: error.message };
    }
  
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    return { data };
  }

export async function submitTask(id: string, evidenceData: { text?: string; imageUrl?: string; videoUrl?: string }) {
  const supabase = await createClient();
  
  // 1. Update task status
  const { error: taskError } = await supabase.from("tasks").update({ status: "in_review" }).eq("id", id);
  if (taskError) {
      console.error("Error submitting task:", taskError);
      return { error: taskError.message };
  }

  // 2. Add evidence
  if (evidenceData.text || evidenceData.imageUrl || evidenceData.videoUrl) {
    let type = 'text';
    let content = evidenceData.text || '';
    if (evidenceData.imageUrl) {
        type = 'image';
        content = evidenceData.imageUrl;
    } else if (evidenceData.videoUrl) {
        type = 'video';
        content = evidenceData.videoUrl;
    }
    const { error: evidenceError } = await supabase.from("task_evidence").insert({
        task_id: id,
        type: type,
        content: content,
    });
    if (evidenceError) {
         console.error("Error adding task evidence:", evidenceError);
         return { error: evidenceError.message };
    }
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { success: true };
}

export async function approveTask(id: string, formData: FormData) {
  const supabase = await createClient();
  const rating = parseInt(formData.get("rating") as string) || 0;
  const feedback = formData.get("feedback") as string;

  const { data, error } = await supabase.from("tasks").update({ 
      status: "approved",
      rating,
      dom_feedback: feedback
   }).eq("id", id).select().single();

  if (error) {
    console.error("Error approving task:", error);
    return { error: error.message };
  }

  // TODO: Add points to user

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { data };
}

export async function rejectTask(id: string, formData: FormData) {
    const supabase = await createClient();
    const feedback = formData.get("feedback") as string;
  
    const { data, error } = await supabase.from("tasks").update({ 
        status: "rejected",
        dom_feedback: feedback
     }).eq("id", id).select().single();
  
    if (error) {
      console.error("Error rejecting task:", error);
      return { error: error.message };
    }
  
    revalidatePath("/tasks");
    revalidatePath(`/tasks/${id}`);
    return { data };
  }
