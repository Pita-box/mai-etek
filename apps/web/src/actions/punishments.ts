"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  Punishment,
  PunishmentPlan,
  PunishmentPlanItem,
  PunishmentPlanStatus,
  PunishmentSeverity,
  PunishmentSubProfile,
  PunishmentTaskSummary,
  PunishmentViewerRole,
} from "@/types/punishment";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = {
  id: string;
  role: string | null;
  dom_id?: string | null;
  full_name: string | null;
};

type PunishmentTaskJoin = PunishmentTaskSummary | PunishmentTaskSummary[] | null;

type PunishmentRow = Omit<Punishment, "severity" | "task" | "categories" | "usage_count"> & {
  severity: number;
  categories?: string[] | null;
  usage_count?: number | null;
  tasks?: PunishmentTaskJoin;
};

type PunishmentPlanRow = Omit<PunishmentPlan, "items" | "status"> & {
  status: string | null;
};

type PunishmentPlanItemRow = Omit<PunishmentPlanItem, "severity_snapshot" | "categories_snapshot"> & {
  severity_snapshot: number;
  categories_snapshot?: string[] | null;
};

type PunishmentTemplateSnapshotRow = Pick<PunishmentRow, "id" | "title" | "description" | "severity" | "categories">;

type PunishmentViewerContext = {
  userId: string;
  role: PunishmentViewerRole;
  subProfiles: PunishmentSubProfile[];
};

function normalizeSeverity(value: number): PunishmentSeverity {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }

  return 1;
}

function normalizePlanStatus(value: string | null): PunishmentPlanStatus {
  if (value === "draft" || value === "ready" || value === "used" || value === "archived") {
    return value;
  }

  return "draft";
}

function normalizeTaskJoin(taskJoin: PunishmentTaskJoin): PunishmentTaskSummary | null {
  if (Array.isArray(taskJoin)) {
    return taskJoin[0] || null;
  }

  return taskJoin || null;
}

function normalizeCategory(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40).trim();
}

function normalizeCategories(categories: unknown) {
  if (!Array.isArray(categories)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const category of categories) {
    if (typeof category !== "string") continue;

    const cleanCategory = normalizeCategory(category);
    const categoryKey = cleanCategory.toLowerCase();
    if (!cleanCategory || seen.has(categoryKey)) continue;

    seen.add(categoryKey);
    normalized.push(cleanCategory);
    if (normalized.length >= 12) break;
  }

  return normalized;
}

function normalizeUsageCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizePosition(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizePunishment(row: PunishmentRow): Punishment {
  const { tasks, ...punishment } = row;

  return {
    ...punishment,
    categories: normalizeCategories(row.categories || []),
    severity: normalizeSeverity(row.severity),
    usage_count: normalizeUsageCount(row.usage_count),
    task: normalizeTaskJoin(tasks || null),
  };
}

function normalizePunishmentPlanItem(row: PunishmentPlanItemRow): PunishmentPlanItem {
  return {
    ...row,
    severity_snapshot: normalizeSeverity(row.severity_snapshot),
    categories_snapshot: normalizeCategories(row.categories_snapshot || []),
    position: normalizePosition(row.position),
    is_done: Boolean(row.is_done),
  };
}

function normalizePunishmentPlan(row: PunishmentPlanRow, items: PunishmentPlanItem[] = []): PunishmentPlan {
  return {
    ...row,
    status: normalizePlanStatus(row.status),
    items: items.sort((a, b) => a.position - b.position || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  };
}

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function parseSeverity(value: FormDataEntryValue | null): PunishmentSeverity {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return normalizeSeverity(parsed);
}

function parseCategories(formData: FormData) {
  const categoryValues = formData
    .getAll("categories")
    .filter((value): value is string => typeof value === "string");

  return normalizeCategories(categoryValues);
}

function getTemplateInput(formData: FormData) {
  const title = normalizeText(formData.get("title"), 255);
  const description = normalizeText(formData.get("description"), 4000);
  const severity = parseSeverity(formData.get("severity"));
  const categories = parseCategories(formData);

  if (!title) {
    return { error: "Název trestu je povinný." };
  }

  return {
    data: {
      title,
      description: description || null,
      severity,
      categories,
    },
  };
}

function parseEventAt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return { event_at: null as string | null };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Datum akce není platné." };
  }

  return { event_at: parsed.toISOString() };
}

function getPlanInput(formData: FormData) {
  const title = normalizeText(formData.get("title"), 255);
  const description = normalizeText(formData.get("description"), 4000);
  const eventAt = parseEventAt(formData.get("event_at"));

  if (!title) {
    return { error: "Název plánu je povinný." };
  }

  if (eventAt.error) {
    return { error: eventAt.error };
  }

  return {
    data: {
      title,
      description: description || null,
      event_at: eventAt.event_at,
    },
  };
}

async function requireDomContext(supabase: SupabaseServerClient) {
  const { context, error } = await getPunishmentViewerContext(supabase);

  if (error || !context) {
    return { context: null, error: error || "Unable to load viewer" };
  }

  if (context.role !== "dom") {
    return { context: null, error: "Forbidden" };
  }

  return { context, error: null };
}

async function getPunishmentViewerContext(
  supabase: SupabaseServerClient
): Promise<{ context: PunishmentViewerContext | null; error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { context: null, error: "Not authenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, dom_id, full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { context: null, error: profileError?.message || "Profile not found" };
  }

  const viewerProfile = profile as ProfileRow;
  const role: PunishmentViewerRole = viewerProfile.role === "dom" ? "dom" : "sub";
  let subProfiles: PunishmentSubProfile[] = [];

  if (role === "dom") {
    const { data: subs, error: subsError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("dom_id", session.user.id)
      .order("full_name", { ascending: true });

    if (subsError) {
      return { context: null, error: subsError.message };
    }

    subProfiles = ((subs || []) as PunishmentSubProfile[]).filter((sub) => Boolean(sub.id));
  }

  return {
    context: {
      userId: session.user.id,
      role,
      subProfiles,
    },
    error: null,
  };
}

async function getPlansForContext(supabase: SupabaseServerClient, userId: string) {
  const { data: plansData, error: plansError } = await supabase
    .from("punishment_plans")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (plansError) {
    return { error: plansError.message, plans: [] as PunishmentPlan[] };
  }

  const planRows = (plansData || []) as PunishmentPlanRow[];
  const planIds = planRows.map((plan) => plan.id);
  let itemRows: PunishmentPlanItemRow[] = [];

  if (planIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabase
      .from("punishment_plan_items")
      .select("*")
      .in("plan_id", planIds)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (itemsError) {
      return { error: itemsError.message, plans: [] as PunishmentPlan[] };
    }

    itemRows = (itemsData || []) as PunishmentPlanItemRow[];
  }

  const itemsByPlan = new Map<string, PunishmentPlanItem[]>();
  for (const item of itemRows.map(normalizePunishmentPlanItem)) {
    const currentItems = itemsByPlan.get(item.plan_id) || [];
    currentItems.push(item);
    itemsByPlan.set(item.plan_id, currentItems);
  }

  const plans = planRows
    .map((plan) => normalizePunishmentPlan(plan, itemsByPlan.get(plan.id) || []))
    .sort((a, b) => {
      const aDate = a.event_at ? new Date(a.event_at).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.event_at ? new Date(b.event_at).getTime() : Number.POSITIVE_INFINITY;

      return aDate - bDate || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return { plans };
}

export async function getPunishments() {
  const supabase = await createClient();
  const { context, error: contextError } = await getPunishmentViewerContext(supabase);

  if (contextError || !context) {
    return {
      error: contextError || "Unable to load viewer",
      role: "sub" as PunishmentViewerRole,
      punishments: [] as Punishment[],
      templates: [] as Punishment[],
      plans: [] as PunishmentPlan[],
      subProfiles: [] as PunishmentSubProfile[],
    };
  }

  if (context.role !== "dom") {
    return {
      role: context.role,
      punishments: [] as Punishment[],
      templates: [] as Punishment[],
      plans: [] as PunishmentPlan[],
      subProfiles: [] as PunishmentSubProfile[],
    };
  }

  const { data, error } = await supabase
    .from("punishments")
    .select("*, tasks(id, public_task_id, title)")
    .eq("is_template", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching punishments:", error);
    return {
      error: error.message,
      role: context.role,
      punishments: [] as Punishment[],
      templates: [] as Punishment[],
      plans: [] as PunishmentPlan[],
      subProfiles: context.subProfiles,
    };
  }

  const rows = ((data || []) as PunishmentRow[]).map(normalizePunishment);
  const { plans, error: plansError } = await getPlansForContext(supabase, context.userId);

  return {
    error: plansError,
    role: context.role,
    punishments: [] as Punishment[],
    templates: rows
      .sort((a, b) => b.severity - a.severity || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    plans: plans || [],
    subProfiles: context.subProfiles,
  };
}

export async function getPunishmentPlans() {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden", plans: [] as PunishmentPlan[] };
  }

  return getPlansForContext(supabase, context.userId);
}

export async function getPunishmentPlan(id: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden", plan: null as PunishmentPlan | null };
  }

  const { plans, error } = await getPlansForContext(supabase, context.userId);
  if (error) {
    return { error, plan: null as PunishmentPlan | null };
  }

  return { plan: plans.find((plan) => plan.id === id) || null };
}

export async function getPunishmentTemplates() {
  const supabase = await createClient();
  const { context, error: contextError } = await getPunishmentViewerContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Unable to load viewer", templates: [] as Punishment[] };
  }

  if (context.role !== "dom") {
    return { error: "Forbidden", templates: [] as Punishment[] };
  }

  const { data, error } = await supabase
    .from("punishments")
    .select("*, tasks(id, public_task_id, title)")
    .eq("is_template", true)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching punishment templates:", error);
    return { error: error.message, templates: [] as Punishment[] };
  }

  return { templates: ((data || []) as PunishmentRow[]).map(normalizePunishment) };
}

async function unsetDoneItemsForPlan(supabase: SupabaseServerClient, planId: string) {
  const { data, error } = await supabase
    .from("punishment_plan_items")
    .select("id")
    .eq("plan_id", planId)
    .eq("is_done", true);

  if (error) {
    return { error: error.message };
  }

  for (const item of (data || []) as Array<{ id: string }>) {
    const { error: toggleError } = await supabase.rpc("set_punishment_plan_item_done", {
      item_uuid: item.id,
      next_done: false,
    });

    if (toggleError) {
      return { error: toggleError.message };
    }
  }

  return { success: true };
}

export async function createPunishmentPlan(formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const input = getPlanInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data plánu." };
  }

  const { error } = await supabase.from("punishment_plans").insert({
    ...input.data,
    created_by: context.userId,
  });

  if (error) {
    console.error("Error creating punishment plan:", error);
    return { error: error.message };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function updatePunishmentPlan(id: string, formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const input = getPlanInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data plánu." };
  }

  const { data, error } = await supabase
    .from("punishment_plans")
    .update(input.data)
    .eq("id", id)
    .eq("created_by", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error updating punishment plan:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Plán nebyl nalezen." };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function deletePunishmentPlan(id: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const unsetResult = await unsetDoneItemsForPlan(supabase, id);
  if (unsetResult.error) {
    return { error: unsetResult.error };
  }

  const { data, error } = await supabase
    .from("punishment_plans")
    .delete()
    .eq("id", id)
    .eq("created_by", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error deleting punishment plan:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Plán nebyl nalezen." };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function addPunishmentToPlan(planId: string, templateId: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const { data: plan, error: planError } = await supabase
    .from("punishment_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", context.userId)
    .maybeSingle();

  if (planError) {
    console.error("Error loading punishment plan:", planError);
    return { error: planError.message };
  }

  if (!plan) {
    return { error: "Plán nebyl nalezen." };
  }

  const { data: existingItem, error: existingError } = await supabase
    .from("punishment_plan_items")
    .select("id")
    .eq("plan_id", planId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (existingError) {
    console.error("Error checking punishment plan item:", existingError);
    return { error: existingError.message };
  }

  if (existingItem) {
    return { error: "Tento trest už v plánu je." };
  }

  const { data: template, error: templateError } = await supabase
    .from("punishments")
    .select("id, title, description, severity, categories")
    .eq("id", templateId)
    .eq("is_template", true)
    .eq("created_by", context.userId)
    .maybeSingle();

  if (templateError) {
    console.error("Error loading punishment template:", templateError);
    return { error: templateError.message };
  }

  if (!template) {
    return { error: "Šablona trestu nebyla nalezena." };
  }

  const { data: lastItems, error: positionError } = await supabase
    .from("punishment_plan_items")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1);

  if (positionError) {
    console.error("Error loading punishment plan item position:", positionError);
    return { error: positionError.message };
  }

  const lastPosition = normalizePosition(((lastItems || []) as Array<{ position: number | null }>)[0]?.position);
  const templateRow = template as PunishmentTemplateSnapshotRow;

  const { error } = await supabase.from("punishment_plan_items").insert({
    plan_id: planId,
    template_id: templateRow.id,
    title_snapshot: templateRow.title,
    description_snapshot: templateRow.description || null,
    severity_snapshot: normalizeSeverity(templateRow.severity),
    categories_snapshot: normalizeCategories(templateRow.categories || []),
    position: (lastItems || []).length > 0 ? lastPosition + 1 : 0,
  });

  if (error) {
    console.error("Error adding punishment to plan:", error);
    return { error: error.message };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function removePunishmentPlanItem(itemId: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const { error: toggleError } = await supabase.rpc("set_punishment_plan_item_done", {
    item_uuid: itemId,
    next_done: false,
  });

  if (toggleError) {
    console.error("Error unsetting punishment plan item:", toggleError);
    return { error: toggleError.message };
  }

  const { data, error } = await supabase
    .from("punishment_plan_items")
    .delete()
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error removing punishment plan item:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Položka plánu nebyla nalezena." };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function reorderPunishmentPlanItems(planId: string, itemIds: string[]) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));

  const { data: plan, error: planError } = await supabase
    .from("punishment_plans")
    .select("id")
    .eq("id", planId)
    .eq("created_by", context.userId)
    .maybeSingle();

  if (planError) {
    console.error("Error loading punishment plan for reorder:", planError);
    return { error: planError.message };
  }

  if (!plan) {
    return { error: "Plán nebyl nalezen." };
  }

  for (const [index, itemId] of uniqueItemIds.entries()) {
    const { error } = await supabase
      .from("punishment_plan_items")
      .update({ position: index })
      .eq("id", itemId)
      .eq("plan_id", planId);

    if (error) {
      console.error("Error reordering punishment plan items:", error);
      return { error: error.message };
    }
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function setPunishmentPlanItemDone(itemId: string, nextDone: boolean) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const { error } = await supabase.rpc("set_punishment_plan_item_done", {
    item_uuid: itemId,
    next_done: nextDone,
  });

  if (error) {
    console.error("Error setting punishment plan item done:", error);
    return { error: error.message };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function createPunishmentTemplate(formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const input = getTemplateInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data šablony." };
  }

  const { error } = await supabase.from("punishments").insert({
    ...input.data,
    is_template: true,
    created_by: context.userId,
  });

  if (error) {
    console.error("Error creating punishment template:", error);
    return { error: error.message };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function updatePunishmentTemplate(id: string, formData: FormData) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const input = getTemplateInput(formData);
  if (input.error || !input.data) {
    return { error: input.error || "Neplatná data šablony." };
  }

  const { data, error } = await supabase
    .from("punishments")
    .update(input.data)
    .eq("id", id)
    .eq("is_template", true)
    .eq("created_by", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error updating punishment template:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Šablona nebyla nalezena." };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function deletePunishmentTemplate(id: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const { data, error } = await supabase
    .from("punishments")
    .delete()
    .eq("id", id)
    .eq("is_template", true)
    .eq("created_by", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error deleting punishment template:", error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "Šablona nebyla nalezena." };
  }

  revalidatePath("/punishments");
  return { success: true };
}

export async function incrementPunishmentTemplateUsage(id: string) {
  const supabase = await createClient();
  const { context, error: contextError } = await requireDomContext(supabase);

  if (contextError || !context) {
    return { error: contextError || "Forbidden" };
  }

  const { data, error } = await supabase.rpc("increment_punishment_template_usage", {
    template_uuid: id,
  });

  if (error) {
    console.error("Error incrementing punishment template usage:", error);
    return { error: error.message };
  }

  revalidatePath("/punishments");
  return { success: true, usage_count: normalizeUsageCount(data as number | null) };
}
