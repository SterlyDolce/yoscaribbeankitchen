import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import MobileNav from "../MobileNav";
import OrderSuccessClient from "./OrderSuccessClient";

export const metadata = {
  title: "Order Placed",
  description: "Your Yo's Caribbean Kitchen order has been placed."
};

export default async function OrderSuccessPage({ searchParams }) {
  const params = await searchParams;
  const orderId = typeof params?.order === "string" ? params.order : "";

  return (
    <main className="site inner-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="order-success-page">
        <div className="order-success-card">
          <CheckCircle2 size={46} />
          <p className="eyebrow">Order placed</p>
          <h1>Order has been placed</h1>
          <p>Yo&apos;s Caribbean Kitchen received your order. Open the order link anytime to check the details.</p>
          <OrderSuccessClient orderId={orderId} />
        </div>
      </section>
    </main>
  );
}
