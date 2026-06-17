import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import MobileNav from "../MobileNav";
import { getMenuItems } from "../menu-data";
import { comingSoon } from "../site-data";
import Image from "next/image";

export const metadata = {
  title: "Menu",
  description: "Explore Yo's Caribbean Kitchen menu of Haitian and Caribbean comfort food."
};

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  let menuItems = [];
  let menuError = null;

  try {
    menuItems = await getMenuItems();
  } catch (error) {
    console.error("Unable to load menu page.", error);
    menuError = "The live menu is temporarily unavailable.";
  }

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
          <p>Our signature dish, a rich and creamy Haitian stew infused with aromatic spices and fresh ingredients.</p>
        <Link className="primary" href="/order/cremasse" aria-label="Start an order for Cremasse">
          Order Now
          <ArrowRight size={18} />
        </Link>
        </div>
        
        <Image src="/kremas.png" className="menu-hero-image" alt="A spread of Yo's Caribbean Kitchen dishes" width={500} height={500} priority />
      </section>

      <section className="full-menu-list">
        {menuError ? (
          <article className="menu-load-error">
            <span className="item-number">!</span>
            <div>
              <h2>Menu unavailable</h2>
              <p>{menuError}</p>
              <strong>Check back shortly</strong>
            </div>
          </article>
        ) : (
          menuItems.map((item, index) => (
            <article key={item.name}>
              <span className="item-number">0{index + 1}</span>
              <img className="menu-item-image" src={item.image} alt={item.name} />
              <div>
                <h2>{item.name}</h2>
                <p className="creole-name">{item.nameInCreole}</p>
                <p>{item.details}</p>
                <strong>{item.tag}</strong>
              </div>
              <CheckCircle2 size={28} />
            </article>
          ))
        )}
      </section>

      <section className="menu-coming">
        <div>
          <p className="eyebrow">Kitchen Notes</p>
          <h2>More favorites are in rotation.</h2>
        </div>
        
      </section>
    </main>
  );
}
