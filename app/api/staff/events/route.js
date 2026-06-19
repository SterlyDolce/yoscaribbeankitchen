import { query } from "../../../db";
import { getStaffUserForRequest } from "../../admin/admin-auth";
import { getVisibleStatusesForPosition } from "../../../staff-positions";

export const dynamic = "force-dynamic";

function eventPayload(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function getQueueFingerprint(staffUser) {
  const visibleStatuses = staffUser ? getVisibleStatusesForPosition(staffUser.staffPosition) : null;
  const values = [];
  const where = ["o.payment_status <> 'expired'"];

  if (visibleStatuses) {
    values.push(visibleStatuses);
    where.push(`o.status = any($${values.length}::text[])`);
  }

  const result = await query(
    `select
       count(distinct o.id)::int as order_count,
       coalesce(max(o.created_at), 'epoch'::timestamptz) as newest_order_at,
       coalesce(max(o.updated_at), 'epoch'::timestamptz) as newest_order_update_at,
       coalesce(max(e.created_at), 'epoch'::timestamptz) as newest_event_at
     from public.orders o
     left join public.order_events e on e.order_id = o.id
     where ${where.join(" and ")}`,
    values
  );

  return JSON.stringify(result.rows[0]);
}

export async function GET(request) {
  const staffUser = await getStaffUserForRequest(request);

  if (!staffUser || !["admin", "staff"].includes(staffUser.role)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastFingerprint = "";

  const stream = new ReadableStream({
    async start(controller) {
      async function send(event, data) {
        if (closed) return;
        controller.enqueue(encoder.encode(eventPayload(event, data)));
      }

      async function checkForChanges() {
        try {
          const fingerprint = await getQueueFingerprint(staffUser);

          if (!lastFingerprint) {
            lastFingerprint = fingerprint;
            await send("connected", { ok: true });
            return;
          }

          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            await send("orders_changed", { at: new Date().toISOString() });
          } else {
            await send("heartbeat", { at: new Date().toISOString() });
          }
        } catch (error) {
          console.error("Failed to check staff event stream.", error);
          await send("error", { message: "Unable to check for order updates." });
        }
      }

      await checkForChanges();
      const interval = setInterval(checkForChanges, 5000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no"
    }
  });
}
