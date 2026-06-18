import Link from "next/link";
import { Clock, Flame, Menu, ShoppingBag, UserRound } from "lucide-react";

export default function HomeScreen() {
  return (
    <main className="site app-home-site">
      <section className="app-home-screen" id="home">
        <header className="app-home-top">
          <div>
            <button className="app-home-top-button" type="button">
              <UserRound size={16} />
            </button>
          </div>
          <img src="/yos-one-cropped.png" alt="Yo's Caribbean Kitchen app icon" width={58} height={58} />
          <div>
            <button className="app-home-top-button" type="button">
              <ShoppingBag size={16} />
              <span>1</span>
            </button>
          </div>
        </header>

        <section className="app-hero-card">
          <div className="app-hero-copy">
            <span>
              <Flame size={11} />
              Fresh comfort food
            </span>
            <h2>Griyo konplè.</h2>
            <button className="app-home-primary" type="button">
              <ShoppingBag size={16} />
              Add to bag
            </button>
          </div>
          <img src="/griot.png" alt="Griot plate" width={240} height={220} />
        </section>

        <section className="app-action-panel" aria-label="Quick order actions">
          <Link className="app-home-primary" href="/order">
            <ShoppingBag size={22} />
            Start order
          </Link>

          <div className="app-home-shortcuts" aria-label="Quick links">
            <Link href="/menu"><Menu size={20} /><span>Menu</span></Link>
            <Link href="/account"><UserRound size={20} /><span>Account</span></Link>
          </div>

          <div className="app-home-status">
            <Clock size={18} />
            <span>Online order requests open</span>
          </div>
        </section>

        <section className="app-featured" aria-label="Featured dishes">
          <div className="app-section-heading">
            <h2>Popular today</h2>
            <Link href="/menu">See all</Link>
          </div>
          <div className="app-dish-rail">
            {[
              { image: "/soup-joumou.png", name: "Soup Joumou", tag: "Current special" },
              { image: "/plantain.png", name: "Banan Peze", tag: "Crispy side" },
              { image: "/rice-and-beans.png", name: "Rice & Beans", tag: "Classic side" }
            ].map((dish) => (
              <Link className="app-dish-card" href="/menu" key={dish.name}>
                <img src={dish.image} alt={dish.name} />
                <strong>{dish.name}</strong>
                <span>{dish.tag}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
