"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Search,
  ShoppingBag,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMenuItemSelections, getMenuItemUnitPrice } from "../menu-customizations";
import { orderBagStorageKey, readOrderBag, writeOrderBag } from "./order-bag";

const categories = ["all", "appetizer", "soup", "main", "side", "drink"];
const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

export default function OrderForm({ menuItems }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bag, setBag] = useState([]);
  const [isMobileTicket, setIsMobileTicket] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const syncBag = () => setBag(readOrderBag());
    const syncStorage = (event) => {
      if (!event.key || event.key === orderBagStorageKey) syncBag();
    };

    syncBag();
    window.addEventListener("order-bag-change", syncBag);
    window.addEventListener("storage", syncStorage);

    return () => {
      window.removeEventListener("order-bag-change", syncBag);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 560px)");
    const syncTicketMode = () => {
      setIsMobileTicket(mediaQuery.matches);
      setCollapsed(mediaQuery.matches);
    };

    syncTicketMode();
    mediaQuery.addEventListener("change", syncTicketMode);
    return () => mediaQuery.removeEventListener("change", syncTicketMode);
  }, []);

  const menuBySlug = useMemo(
    () => new Map(menuItems.map((item) => [item.slug, item])),
    [menuItems]
  );

  const bagLines = useMemo(
    () => bag
      .map((line, index) => ({ ...line, item: menuBySlug.get(line.slug), lineIndex: index }))
      .filter((line) => line.item && Number.isInteger(line.quantity) && line.quantity > 0),
    [bag, menuBySlug]
  );

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(categories.map((category) => [category, 0]));
    counts.all = menuItems.length;
    for (const item of menuItems) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
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

  const totalItems = bagLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = bagLines.reduce(
    (total, line) => total + line.quantity * getMenuItemUnitPrice(line.item, line.selections),
    0
  );

  const serviceFee = totalItems > 0 ? 1.75 : 0;
  const tax = subtotal * 0.07;
  const total = serviceFee + subtotal + tax;
  const ticketSummary = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;

  function clearTicket() {
    writeOrderBag([]);
    setBag([]);
  }

  function removeLine(lineIndex) {
    const nextBag = bag.filter((_, index) => index !== lineIndex);
    writeOrderBag(nextBag);
    setBag(nextBag);
  }

  function toggleTicket() {
    if (isMobileTicket) setCollapsed((current) => !current);
  }

  return (
    <section className="order-layout">
      <div className="pos-menu-panel">

        <div className="pos-toolbar">
                      <p className="eyebrow">Menu</p>

        </div>

        <div className="order-filters">
          {/* <label className="menu-search">
            <Search size={18} />
            <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search griot, rice, soup..." type="search" value={searchTerm} />
          </label> */}
          <div className="pos-categories" aria-label="Menu categories">
            {categories.map((category) => (
              <button className={activeCategory === category ? "active" : ""} key={category} onClick={() => setActiveCategory(category)} type="button">
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>

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
                {/* <span className="item-tag">{item.tag}</span> */}
                <img className="menu-item-image" src={item.image} alt={item.name} />
                <strong>{item.name}</strong>
                <em>{item.nameInCreole}</em>
                <span className="item-price">{formatter.format(item.price)}</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
      {totalItems != 0 && (


        <aside className={collapsed ? "pos-ticket is-collapsed" : "pos-ticket is-expanded"}>
          <div className="pos-ticket-header">
            <button aria-controls="order-ticket-body" aria-expanded={!collapsed} className="ticket-toggle" onClick={toggleTicket} type="button">
              <span>
                <p className="eyebrow">Review bag</p>
                <h2>{collapsed ? formatter.format(total) : "Your bag"}</h2>
                <small>{collapsed ? ticketSummary : "Review and send"}</small>
              </span>
              {collapsed ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </button>
            <button className="clear-ticket-button" disabled={totalItems === 0} onClick={clearTicket} type="button">Clear</button>
          </div>

          <div className="ticket-body" id="order-ticket-body">
            <div className={collapsed ? "ticket-lines is-collapsed" : "ticket-lines is-expanded"} aria-label="Order summary">
              {bagLines.length === 0 ? (
                <div className="empty-ticket"><ShoppingBag size={34} /><p>Your bag is empty.</p></div>
              ) : bagLines.map((line) => (
                <div className="ticket-line" key={`${line.slug}-${line.lineIndex}`}>
                  <div>
                    <strong>{line.item.name}</strong>
                    <span>{line.quantity} x {formatter.format(getMenuItemUnitPrice(line.item, line.selections))}</span>
                    {formatMenuItemSelections(line.item, line.selections) && (
                      <small>{formatMenuItemSelections(line.item, line.selections)}</small>
                    )}
                    {line.instructions && <small>{line.instructions}</small>}
                    <Link className="ticket-edit-link" href={`/menu/${line.slug}`}>Customize another</Link>
                  </div>
                  <div className="ticket-line-actions">
                    <b>{formatter.format(line.quantity * getMenuItemUnitPrice(line.item, line.selections))}</b>
                    <button aria-label={`Remove ${line.item.name}`} onClick={() => removeLine(line.lineIndex)} type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="ticket-total" aria-label="Order total">
              <span>Items<strong>{totalItems}</strong></span>
              <span>Subtotal<strong>{formatter.format(subtotal)}</strong></span>
              <span>Tax<strong>{formatter.format(tax)}</strong></span>
              <span>Service Fee<strong>{formatter.format(serviceFee)}</strong></span>
              <span className="grand-total">Estimated total<strong>{formatter.format(total)}</strong></span>
            </div>

            <Link className={totalItems === 0 ? "disabled-link" : ""} href="/confirm-order">
              Checkout
              <ArrowRight size={18} />
            </Link>
          </div>
        </aside>
      )}
    </section>
  );
}
