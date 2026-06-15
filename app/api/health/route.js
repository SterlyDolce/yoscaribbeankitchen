import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  if (!hasDatabaseConfig()) {
    return NextResponse.json(
      {
        database: "missing",
        ok: false,
        service: "yos-caribbean-kitchen"
      },
      { status: 503 }
    );
  }

  try {
    await query("select 1");

    return NextResponse.json({
      database: "ok",
      ok: true,
      responseMs: Date.now() - startedAt,
      service: "yos-caribbean-kitchen"
    });
  } catch (error) {
    console.error("Health check database failure.", error);

    return NextResponse.json(
      {
        database: "error",
        ok: false,
        responseMs: Date.now() - startedAt,
        service: "yos-caribbean-kitchen"
      },
      { status: 503 }
    );
  }
}
