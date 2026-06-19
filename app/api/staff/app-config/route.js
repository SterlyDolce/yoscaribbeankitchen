import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    currentVersion: process.env.STAFF_APP_CURRENT_VERSION || "1.0.0",
    minVersion: process.env.STAFF_APP_MIN_VERSION || "1.0.0",
    updateMessage: process.env.STAFF_APP_UPDATE_MESSAGE || "Update required before continuing."
  });
}
