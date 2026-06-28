"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { writeOrderBag } from "../order/order-bag";

export default function OrderSuccessClient({ orderId }) {
  const [origin, setOrigin] = useState("");
  const orderPath = orderId ? `/orders/${orderId}` : "/account";
  const orderUrl = useMemo(() => (origin ? `${origin}${orderPath}` : orderPath), [orderPath, origin]);

  useEffect(() => {
    writeOrderBag([]);
    window.dispatchEvent(new Event("order-bag-change"));
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="order-success-actions">
      <div className="order-success-link">
        <span>Order link</span>
        <code>{orderUrl}</code>
      </div>
      <Link className="order-success-primary" href={orderPath}>
        Open order
      </Link>
      <Link className="order-success-secondary" href="/menu">
        Back to menu
      </Link>
    </div>
  );
}
