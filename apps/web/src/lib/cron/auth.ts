import "server-only";

import { NextRequest, NextResponse } from "next/server";

export function getCronAuthError(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET není nastavený." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() || "";
  const providedSecret = bearerToken || headerSecret;

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: "Neplatný cron secret." },
      { status: 401 },
    );
  }

  return null;
}
