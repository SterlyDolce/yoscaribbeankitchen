import Link from "next/link";
import Image from "next/image";
import MobileNav from "../MobileNav";
import { getMenuItems } from "../menu-data";
import OrderForm from "../order/OrderForm";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Menu",
  description: "Browse Yo's Caribbean Kitchen menu and build an order request."
};

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const menuItems = await getMenuItems();

  return (
    <main className="site inner-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="page-hero menu-page-hero">
        <div>
          <p className="eyebrow">Menu</p>
          <h1>Kremas</h1>
          <b>Only For $4.29</b>
          <p>Our signature Haitian drink, rich, creamy, and infused with warm spices.</p>
          <Link className="primary" href="/order/cremasse" aria-label="Start an order for Cremasse">
            Order Now
            <ArrowRight size={18} />
          </Link>
        </div>

        <Image src="/kremas.png" className="menu-hero-image" alt="Kremas bottle" width={500} height={500} priority />
      </section>

      <OrderForm menuItems={menuItems} />
    </main>
  );
}
