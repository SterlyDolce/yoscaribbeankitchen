"use client";

import { ShoppingBag } from "lucide-react";
import { openOrderBag } from "./order/order-bag";

export default function BagButton({ className = "app-home-top-button", label = false }) {
  return (
    <button className={className} onClick={openOrderBag} type="button" aria-label="Open bag">
      <ShoppingBag size={label ? 16 : 22} />
      {label && <span>Open bag</span>}
    </button>
  );
}
