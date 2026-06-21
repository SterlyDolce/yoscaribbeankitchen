"use client";

import Link from "next/link";
import { Heart, Search, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getServiceAreaCities } from "./service-area";

const categories = ["all", "appetizer", "soup", "main", "side", "drink"];
const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

const bannerTargets = ["griot", "soup-joumou", "haitian-patty"];
const favoritesStorageKey = "yos-menu-favorites";
const defaultLocationLabel = "Pompano Beach";
const maxLocationMatchMiles = 15;
const serviceAreaCoordinates = {
  "Coconut Creek": { latitude: 26.2517, longitude: -80.1789 },
  "Deerfield Beach": { latitude: 26.3184, longitude: -80.0998 },
  "Fort Lauderdale": { latitude: 26.1224, longitude: -80.1373 },
  "Lauderdale Lakes": { latitude: 26.1665, longitude: -80.2084 },
  "Lauderdale-by-the-Sea": { latitude: 26.192, longitude: -80.0964 },
  "Lighthouse Point": { latitude: 26.2756, longitude: -80.0873 },
  "Margate": { latitude: 26.2445, longitude: -80.2064 },
  "North Lauderdale": { latitude: 26.2173, longitude: -80.2259 },
  "Oakland Park": { latitude: 26.1723, longitude: -80.131 },
  "Pompano Beach": { latitude: 26.2379, longitude: -80.1248 },
  "Tamarac": { latitude: 26.2129, longitude: -80.2498 },
  "Wilton Manors": { latitude: 26.1604, longitude: -80.1389 }
};
const serviceAreaLocationCandidates = getServiceAreaCities()
  .map((label) => ({ label, ...serviceAreaCoordinates[label] }))
  .filter((location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude));

function getDistanceMiles(from, to) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getNearestServiceLocation(latitude, longitude) {
  const currentLocation = { latitude, longitude };
  const nearest = serviceAreaLocationCandidates
    .map((location) => ({ ...location, distance: getDistanceMiles(currentLocation, location) }))
    .sort((first, second) => first.distance - second.distance)[0];

  if (!nearest || nearest.distance > maxLocationMatchMiles) {
    return "Your area";
  }

  return nearest.label;
}

export default function OrderForm({ menuItems }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [favorites, setFavorites] = useState([]);
  const [locationLabel, setLocationLabel] = useState(defaultLocationLabel);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(favoritesStorageKey) || "[]");
      if (Array.isArray(saved)) setFavorites(saved.filter((slug) => typeof slug === "string"));
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocationLabel(getNearestServiceLocation(coords.latitude, coords.longitude)),
      () => setLocationLabel(defaultLocationLabel),
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 6000 }
    );
  }, []);

  const bannerItems = useMemo(() => {
    const bySlug = new Map(menuItems.map((item) => [item.slug, item]));
    return bannerTargets.map((slug) => bySlug.get(slug)).filter(Boolean);
  }, [menuItems]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(categories.map((category) => [category, 0]));
    counts.all = menuItems.length;
    for (const item of menuItems) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, [menuItems]);

  const categoryPreviews = useMemo(() => {
    const previews = new Map();
    for (const item of menuItems) {
      if (!previews.has(item.category)) previews.set(item.category, item.image);
    }
    if (menuItems[0]) previews.set("all", menuItems[0].image);
    return previews;
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch = normalizedSearch.length === 0 ||
        [item.name, item.nameInCreole, item.note, item.tag, item.details]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, menuItems, searchTerm]);

  function toggleFavorite(event, slug) {
    event.preventDefault();
    event.stopPropagation();

    setFavorites((current) => {
      const next = current.includes(slug)
        ? current.filter((favoriteSlug) => favoriteSlug !== slug)
        : [...current, slug];
      window.localStorage.setItem(favoritesStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="order-layout">
      <div className="pos-menu-panel">
        <div className="menu-app-topbar">
          <label className="menu-search">
            <Search size={18} />
            <input data-menu-search onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search" type="search" value={searchTerm} />
          </label>
          <div>
            <span>Location</span>
            <strong>{locationLabel}</strong>
          </div>
          <img src="/pwa-icon.png" alt="Yo's" />
        </div>

        <div className="menu-section-heading">
          <h1>{locationLabel}</h1>
          <small>{visibleItems.length} shown</small>
        </div>

        <div className="pos-categories" aria-label="Menu categories">
          {categories.map((category) => (
            <button className={activeCategory === category ? "active" : ""} key={category} onClick={() => setActiveCategory(category)} type="button">
              {categoryPreviews.get(category) && <img src={categoryPreviews.get(category)} alt="" aria-hidden="true" />}
              <span>{category}</span>
              <b>{categoryCounts[category] || 0}</b>
            </button>
          ))}
        </div>

        {bannerItems.length > 0 && (
          <div className="menu-swipe-banner" aria-label="Featured menu items">
            {bannerItems.map((item, index) => (
              <Link className={`menu-banner-card banner-tone-${index % 3}`} href={`/menu/${item.slug}`} key={item.slug}>
                <div>
                  <strong>{index === 0 ? "Discount 40%" : item.name}</strong>
                  <small>{index === 0 ? "Learn More" : item.note || "Customize it and add it to your bag."}</small>
                </div>
                <img src={item.image} alt="" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}

        <div className="pos-item-grid">
          {visibleItems.length === 0 ? (
            <div className="menu-empty-state">
              <ShoppingBag size={34} />
              <strong>No matching items.</strong>
              <p>Try another search or category.</p>
            </div>
          ) : visibleItems.map((item) => (
            <article className="pos-item-card" key={item.name}>
              <Link href={`/menu/${item.slug}`}>
                <button
                  aria-label={favorites.includes(item.slug) ? `Remove ${item.name} from favorites` : `Save ${item.name}`}
                  aria-pressed={favorites.includes(item.slug)}
                  className={favorites.includes(item.slug) ? "menu-favorite-button is-favorite" : "menu-favorite-button"}
                  onClick={(event) => toggleFavorite(event, item.slug)}
                  type="button"
                >
                  <Heart size={17} fill={favorites.includes(item.slug) ? "currentColor" : "none"} />
                </button>
                <div className="menu-card-image">
                  <img className="menu-item-image" src={item.image} alt={item.name} />
                </div>
                <div className="menu-card-copy">
                  <strong>{item.name}</strong>
                  {item.nameInCreole && <em>{item.nameInCreole}</em>}
                  <div className="menu-card-action">
                    <b>{formatter.format(item.price)}</b>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
