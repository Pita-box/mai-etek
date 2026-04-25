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
  const { data: task, error } = await supabase
    .from("tasks")
    .select("*, task_evidence(*)")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    return null;
  }
  return task;
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  // TODO: validate input with zod
  const task = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    priority: formData.get("priority") as string,
    points_reward: parseInt(formData.get("points_reward") as string) || 0,
    deadline: formData.get("deadline") as string || null,
    status: "pending",
  };

  const { data, error } = await supabase.from("tasks").insert(task).select().single();

  if (error) {
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
