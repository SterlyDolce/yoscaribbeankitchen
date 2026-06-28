"use client";

import { useEffect, useMemo, useState } from "react";

const trackerSteps = [
  { label: "Placed", status: "requested" },
  { label: "Confirmed", status: "confirmed" },
  { label: "Preparing", status: "preparing" },
  { label: "Ready", status: "ready" },
  { label: "On the way", status: "in_route" },
  { label: "Delivered", status: "completed" }
];

function formatOrderStatus(status) {
  if (!status) return "Order placed";
  if (status === "in_route") return "On the way";

  return status.replace(/_/g, " ");
}

function getStepIndex(status) {
  if (status === "cancelled") return 0;

  const index = trackerSteps.findIndex((step) => step.status === status);
  return index === -1 ? 0 : index;
}

export default function OrderProgressTracker({ initialReadyTime, initialStatus, orderId }) {
  const [orderState, setOrderState] = useState({
    readyTime: initialReadyTime,
    status: initialStatus
  });

  useEffect(() => {
    let active = true;

    async function refreshStatus() {
      try {
        const response = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (!response.ok) return;

        const result = await response.json();
        if (!active) return;

        setOrderState({
          readyTime: result.order?.readyTime || "",
          status: result.order?.status || initialStatus
        });
      } catch {
        // The server-rendered status remains visible if a poll fails.
      }
    }

    const interval = window.setInterval(refreshStatus, 6000);
    refreshStatus();

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [initialStatus, orderId]);

  const activeIndex = getStepIndex(orderState.status);
  const isCancelled = orderState.status === "cancelled";
  const progress = useMemo(() => {
    if (isCancelled) return 100;
    return (activeIndex / (trackerSteps.length - 1)) * 100;
  }, [activeIndex, isCancelled]);

  return (
    <section className={`order-tracker ${isCancelled ? "cancelled" : ""}`} aria-label="Order progress">
      <div className="order-tracker-heading">
        <div>
          <p className="eyebrow">Order Tracker</p>
          <h2>{isCancelled ? "Order cancelled" : formatOrderStatus(orderState.status)}</h2>
        </div>
        {orderState.readyTime && !isCancelled && <span>Ready by {orderState.readyTime}</span>}
      </div>

      <div className="order-tracker-rail" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <ol className="order-tracker-steps">
        {trackerSteps.map((step, index) => {
          const complete = !isCancelled && index <= activeIndex;

          return (
            <li className={complete ? "complete" : ""} key={step.status}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
