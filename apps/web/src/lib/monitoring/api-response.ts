import { NextResponse } from "next/server"

const monitoringCorsHeaders = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
}

export function monitoringJson(
  body: unknown,
  init: ResponseInit = {},
) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...monitoringCorsHeaders,
      ...init.headers,
    },
  })
}

export function monitoringOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: monitoringCorsHeaders,
  })
}
