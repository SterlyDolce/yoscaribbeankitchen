"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LockKeyhole,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMenuItemSelections, getMenuItemUnitPrice } from "../menu-customizations";
import { orderBagStorageKey, readOrderBag, writeOrderBag } from "./order-bag";

const categories = ["all", "appetizer", "soup", "main", "side"];
const orderModes = ["Pickup", "Delivery"];
const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

export default function OrderForm({ menuItems, user }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [orderMode, setOrderMode] = useState(orderModes[0]);
  const [paymentType, setPaymentType] = useState("Pay in person");
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
  const deliveryFee = totalItems > 0 && orderMode === "Delivery" ? 1.25 : 0;
  const tax = subtotal * 0.07;
  const total = serviceFee + deliveryFee + subtotal + tax;
  const ticketSummary = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
  const hasDeliveryAddress = Boolean(user?.addressLine1 && user?.city && user?.state && user?.postalCode);
  const needsDeliveryAddress = orderMode === "Delivery" && user && !hasDeliveryAddress;

  function clearTicket() {
    writeOrderBag([]);
    setBag([]);
    setStatus(null);
  }

  function removeLine(lineIndex) {
    const nextBag = bag.filter((_, index) => index !== lineIndex);
    writeOrderBag(nextBag);
    setBag(nextBag);
    setStatus(null);
  }

  function toggleTicket() {
    if (isMobileTicket) setCollapsed((current) => !current);
  }

  async function placeOrder() {
    setSubmitting(true);
    setStatus(null);
    setCollapsed(false);

    try {
      const response = await fetch("/api/orders", {
        body: JSON.stringify({
          fulfillmentMethod: orderMode,
          items: bagLines.map((line) => ({
            instructions: line.instructions,
            quantity: line.quantity,
            selections: line.selections,
            slug: line.slug
          })),
          paymentPreference: paymentType
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "Unable to place order.");

      clearTicket();
      setStatus({
        kind: "success",
        message: `Order ${result.order.id.slice(0, 8)} received. Yo's will confirm timing.`
      });
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="order-layout">
      <div className="pos-menu-panel">

        <div className="pos-toolbar">
          <div>
            <p className="eyebrow">Menu</p>
            <h2>{visibleItems.length} available</h2>
          </div>
          <div className="pos-mode-switch" aria-label="Fulfillment method">
            {orderModes.map((mode) => (
              <button className={orderMode === mode ? "active" : ""} key={mode} onClick={() => setOrderMode(mode)} type="button">
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="order-filters">
          <label className="menu-search">
            <Search size={18} />
            <input onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search griot, rice, soup..." type="search" value={searchTerm} />
          </label>
          <div className="pos-categories" aria-label="Menu categories">
            {categories.map((category) => (
              <button className={activeCategory === category ? "active" : ""} key={category} onClick={() => setActiveCategory(category)} type="button">
                <span>{category}</span><b>{categoryCounts[category] || 0}</b>
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
              <Link href={`/order/${item.slug}`}>
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

      <aside className={collapsed ? "pos-ticket is-collapsed" : "pos-ticket is-expanded"}>
        <div className="pos-ticket-header">
          <button aria-controls="order-ticket-body" aria-expanded={!collapsed} className="ticket-toggle" onClick={toggleTicket} type="button">
            <span>
              <p className="eyebrow">{orderMode}</p>
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
                  <Link className="ticket-edit-link" href={`/order/${line.slug}`}>Customize another</Link>
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

          <div className="payment-switch" aria-label="Payment preference">
            {["Pay in person", "Pay online"].map((type) => (
              <button className={paymentType === type ? "active" : ""} key={type} onClick={() => setPaymentType(type)} type="button">{type}</button>
            ))}
          </div>

          <div className="ticket-total" aria-label="Order total">
            <span>Items<strong>{totalItems}</strong></span>
            <span>Subtotal<strong>{formatter.format(subtotal)}</strong></span>
            <span>Tax<strong>{formatter.format(tax)}</strong></span>
            <span>Service Fee<strong>{formatter.format(serviceFee)}</strong></span>
            <span>Delivery Fee<strong>{formatter.format(deliveryFee)}</strong></span>
            <span className="grand-total">Total<strong>{formatter.format(total)}</strong></span>
          </div>

          {user ? (
            needsDeliveryAddress ? (
              <Link href="/account"><LockKeyhole size={18} />Add delivery address</Link>
            ) : (
              <button className="place-order-button" disabled={totalItems === 0 || submitting} onClick={placeOrder} type="button">
                <CheckCircle2 size={18} />{submitting ? "Sending order..." : "Place order"}
              </button>
            )
          ) : (
            <Link className={totalItems === 0 ? "disabled-link" : ""} href="/auth"><LockKeyhole size={18} />Sign in to continue</Link>
          )}
          {user && <small>Ordering as {user.email}</small>}
          {orderMode === "Delivery" && hasDeliveryAddress && <small>Delivery to {user.addressLine1}, {user.city}</small>}
          <small>Payment preference: {paymentType}</small>
          {status && <p className={`form-status ${status.kind}`} role="status">{status.message}</p>}
        </div>
      </aside>
    </section>
  );
}
