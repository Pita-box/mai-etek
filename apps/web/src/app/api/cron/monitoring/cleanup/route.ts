import { NextRequest, NextResponse } from "next/server"
import { getCronAuthError } from "@/lib/cron/auth"
import { deleteMonitoringDriveFile } from "@/lib/google-drive/monitoring"
import { createAdminClient } from "@/utils/supabase/admin"

export const dynamic = "force-dynamic"

function getRetentionCutoff() {
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  return cutoff.toISOString()
}

export async function POST(request: NextRequest) {
  const authError = getCronAuthError(request)
  if (authError) return authError

  try {
    const supabase = createAdminClient()
    const cutoff = getRetentionCutoff()
    const { data: oldScreenshots } = await supabase
      .from("monitoring_events")
      .select("metadata")
      .eq("event_type", "page_screenshot")
      .lt("occurred_at", cutoff)

    const { data, error } = await supabase
      .from("monitoring_events")
      .delete()
      .lt("occurred_at", cutoff)
      .select("id")

    if (error) {
      console.error("Monitoring cleanup cron failed:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      )
    }

    const driveFileIds = (oldScreenshots || [])
      .map((row) => {
        const metadata = row.metadata as Record<string, unknown> | null
        const value = metadata?.drive_file_id
        return typeof value === "string" && value.trim() ? value.trim() : null
      })
      .filter((value): value is string => Boolean(value))

    await Promise.all(
      driveFileIds.map((driveFileId) =>
        deleteMonitoringDriveFile(driveFileId).catch((driveError) => {
          console.error("Monitoring cleanup Drive delete failed:", driveError)
        }),
      ),
    )

    return NextResponse.json({
      success: true,
      deletedCount: data?.length || 0,
      deletedDriveFiles: driveFileIds.length,
      cutoff,
    })
  } catch (error) {
    console.error("Monitoring cleanup cron failed:", error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Cron pro čištění monitoringu selhal.",
      },
      { status: 500 },
    )
  }
}

export function GET(request: NextRequest) {
  return POST(request)
}
