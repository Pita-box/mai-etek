import { NextRequest, NextResponse } from "next/server";
import { getCronAuthError } from "@/lib/cron/auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, 500);
}

export async function POST(request: NextRequest) {
  const authError = getCronAuthError(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const { data, error } = await supabase.rpc("expire_due_tasks", {
      run_limit: limit,
    });

    if (error) {
      console.error("Task expiry cron failed:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    console.error("Task expiry cron failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Cron pro expiraci úkolů selhal.",
      },
      { status: 500 },
    );
  }
}

export function GET(request: NextRequest) {
  return POST(request);
}
