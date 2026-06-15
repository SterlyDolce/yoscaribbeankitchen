import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Menu, Phone, ShoppingBag, Sparkles } from "lucide-react";
import MobileNav from "./MobileNav";
import { restaurantInfo } from "./site-data";

export default function RestaurantPage({ menuError, menuItems, variant }) {
  return (
    <main className="site bold-site">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Yo's Caribbean Kitchen home">
          <Image src="/yos-logo.png" alt="Yo's Caribbean Kitchen logo" width={96} height={64} priority />
          <span>Yo&apos;s Caribbean Kitchen</span>
        </Link>
        <MobileNav />
      </header>

      <section className="bold-hero" id="home">
        <div className="bold-feature">
          {["Soup Joumou", "Plantain", "Black Beans"].map((dish) => (
              <Image key={dish} src={`/${dish.toLowerCase().replace(/\s+/g, '-')}.png`} alt={dish} width={640} height={480} priority />
          ))}
          
        </div>
        <div className="bold-copy">
          <p className="eyebrow">{variant.eyebrow}</p>
          <h1>{variant.title}</h1>
          <p>{variant.copy}</p>
          
          <div className="actions">
            <Link className="primary" href="/menu">
              <Menu size={18} />
              {variant.button}
            </Link>
            <Link className="secondary" href="/order">
              <ShoppingBag size={18} />
              Start order
            </Link>
          </div>
        </div>
      </section>

      <section className="status-bar" aria-label="Current restaurant status">
        <span>Online order requests open</span>
        <span>Pickup timing confirmed after order</span>
        <span>Haitian and Caribbean comfort food</span>
      </section>

      <section className="bold-menu" id="menu">
        <div className="menu-intro">
          <p className="eyebrow">Current Menu</p>
          <h2>Comfort plates, sides, and signatures.</h2>
          <p>
            Choose from Yo&apos;s current menu, then send an order request for confirmation before pickup.
          </p>
        </div>
        <div className="bold-menu-board">
          {menuError ? (
            <article className="menu-load-error">
              <span className="item-number">!</span>
              <h3>Menu unavailable</h3>
              <p>{menuError}</p>
              <div>
                <strong>Check back shortly</strong>
                <em>Yo&apos;s is still online.</em>
              </div>
            </article>
          ) : (
            menuItems.map((item, index) => (
              <article key={item.name}>
                <span className="item-number">0{index + 1}</span>
                <h3>{item.name}</h3>
                <p className="creole-name">{item.nameInCreole}</p>
                <p>{item.note}</p>
                <div>
                  <strong>{item.tag}</strong>
                  <em>{item.accent}</em>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="coming-section" id="about">
        <div>
          <p className="eyebrow">Kitchen Notes</p>
          <h2>More favorites are on the way.</h2>
        </div>
      </section>

      <section className="visit" id="visit">
        <div className="visit-panel">
          <Clock size={22} />
          <h3>Ordering</h3>
          <p>{restaurantInfo.hours}</p>
        </div>
        <div className="visit-panel">
          <MapPin size={22} />
          <h3>Service</h3>
          <p>{restaurantInfo.serviceArea}</p>
        </div>
        <div className="visit-panel">
          <Phone size={22} />
          <h3>Confirmation</h3>
          <p>{restaurantInfo.orderNote}</p>
        </div>
      </section>

      <footer className="footer-cta">
        <div>
          <p className="eyebrow">Yo&apos;s Caribbean Kitchen</p>
          <h2>Real Food, Real Good.</h2>
        </div>
        <Link href="/order">
          Start order
          <ArrowRight size={18} />
        </Link>
      </footer>
    </main>
  );
}
