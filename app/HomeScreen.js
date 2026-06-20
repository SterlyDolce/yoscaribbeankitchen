import Link from "next/link";
import { Clock, Flame, Menu, ShoppingBag, Soup, UserRound, Utensils } from "lucide-react";
import BagButton from "./BagButton";

function getItemsByCategory(menuItems, category, limit = 6) {
  return menuItems.filter((item) => item.category === category).slice(0, limit);
}

function getHeroItem(menuItems) {
  return menuItems.find((item) => item.category === "main") || menuItems[0];
}

function DishRail({ items, title, viewAllHref = "/menu" }) {
  if (items.length === 0) return null;

  return (
    <section className="app-featured" aria-label={title}>
      <div className="app-section-heading">
        <h2>{title}</h2>
        <Link href={viewAllHref}>See all</Link>
      </div>
      <div className="app-dish-rail">
        <div>
          {items.map((item) => (
          <a className="app-dish-card" href={`/menu/${item.slug}`} key={item.slug}>
            <img src={item.image} alt={item.name} />
            <strong>{item.name}</strong>
            <span>{item.tag || item.nameInCreole}</span>
          </a>
        ))}
        </div>

      </div>
    </section>
  );
}

export default function HomeScreen({ menuItems = [] }) {
  const heroItem = getHeroItem(menuItems);
  const popularItems = menuItems.slice(0, 6);
  const mainItems = getItemsByCategory(menuItems, "main", 6);
  const sideItems = getItemsByCategory(menuItems, "side", 6);
  const soupItems = getItemsByCategory(menuItems, "soup", 4);
  const drinkItems = getItemsByCategory(menuItems, "drink", 6);

  return (
    <main className="site app-home-site">
      <section className="app-home-screen" id="home">
        <header className="app-home-top">
          <div>
            <Link className="app-home-top-button" href="/account" aria-label="Account">
              <UserRound size={16} />
            </Link>
          </div>
          <img src="/yos-one-cropped.png" alt="Yo's Caribbean Kitchen app icon" width={58} height={58} />
          <div>
            <BagButton />
          </div>
        </header>

        {heroItem && (
          <section className="app-hero-card">
            <div className="app-hero-copy">
              <span>
                <Flame size={11} />
                {heroItem.tag || "Fresh comfort food"}
              </span>
              <h2>{heroItem.nameInCreole || heroItem.name}</h2>
              <a className="app-home-primary" href={`/menu/${heroItem.slug}`}>
                <ShoppingBag size={16} />
                Add to bag
              </a>
            </div>
            <img src={heroItem.image} alt={heroItem.name} width={240} height={220} />
          </section>
        )}

        <section className="app-category-grid" aria-label="Order categories">
          <Link href="/menu">
            <Utensils size={18} />
            <span>Main meals</span>
            <strong>{mainItems.length}</strong>
          </Link>
          <Link href="/menu">
            <Soup size={18} />
            <span>Soups</span>
            <strong>{soupItems.length}</strong>
          </Link>
          <Link href="/menu">
            <ShoppingBag size={18} />
            <span>Sides</span>
            <strong>{sideItems.length}</strong>
          </Link>
        </section>

        <DishRail title="Popular today" items={popularItems} />
        <DishRail title="Main meals" items={mainItems} />
        <DishRail title="Sides to add" items={sideItems} />
        <DishRail title="Drinks" items={drinkItems} />
      </section>
    </main>
  );
}
