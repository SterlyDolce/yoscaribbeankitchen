"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  const [quantities, setQuantities] = useState(
    Object.fromEntries(menuItems.map((item) => [item.slug, 0]))
  );

  const [isMobileTicket, setIsMobileTicket] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(categories.map((category) => [category, 0]));
    counts.all = menuItems.length;

    for (const item of menuItems) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }

    return counts;
  }, [menuItems]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [item.name, item.nameInCreole, item.note, item.tag, item.details]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, menuItems, searchTerm]);

  const ticketItems = useMemo(
    () => menuItems.filter((item) => quantities[item.slug] > 0),
    [quantities]
  );

  const totalItems = useMemo(
    () => Object.values(quantities).reduce((total, quantity) => total + quantity, 0),
    [quantities]
  );

  const subtotal = useMemo(
    () => menuItems.reduce((total, item) => total + quantities[item.slug] * item.price, 0),
    [quantities]
  );
  const tax = subtotal * 0.07;
  const total = subtotal + tax;
  const ticketSummary = `${totalItems} ${totalItems === 1 ? "item" : "items"}`;
  const hasDeliveryAddress = Boolean(user?.addressLine1 && user?.city && user?.state && user?.postalCode);
  const needsDeliveryAddress = orderMode === "Delivery" && user && !hasDeliveryAddress;

  function updateQuantity(slug, delta) {
    setQuantities((current) => ({
      ...current,
      [slug]: Math.max(0, current[slug] + delta)
    }));
    setStatus(null);
  }

  function clearTicket() {
    setQuantities(Object.fromEntries(menuItems.map((item) => [item.slug, 0])));
    setStatus(null);
  }

  function toggleTicket() {
    if (!isMobileTicket) {
      return;
    }

    setCollapsed((current) => !current);
  }

  async function placeOrder() {
    setSubmitting(true);
    setStatus(null);
    setCollapsed(false);

    try {
      const response = await fetch("/api/orders", {
        body: JSON.stringify({
          fulfillmentMethod: orderMode,
          items: ticketItems.map((item) => ({
            quantity: quantities[item.slug],
            slug: item.slug
          })),
          paymentPreference: paymentType
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to place order.");
      }

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
        <div className="order-intro">
          <div>
            <p className="eyebrow">Online order</p>
            <h1>Build your plate.</h1>
            <p>Choose what you want now. Yo&apos;s confirms timing before it hits the kitchen.</p>
          </div>
          <div className="order-intro-badges" aria-label="Order notes">
            <span>
              <Clock3 size={17} />
              Pickup confirmed
            </span>
            <span>
              <Sparkles size={17} />
              Fresh menu
            </span>
          </div>
        </div>

        <div className="pos-toolbar">
          <div>
            <p className="eyebrow">Menu</p>
            <h2>{visibleItems.length} available</h2>
          </div>
          <div className="pos-mode-switch" aria-label="Fulfillment method">
            {orderModes.map((mode) => (
              <button
                className={orderMode === mode ? "active" : ""}
                key={mode}
                onClick={() => setOrderMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="order-filters">
          <label className="menu-search">
            <Search size={18} />
            <input
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search griot, rice, soup..."
              type="search"
              value={searchTerm}
            />
          </label>

          <div className="pos-categories" aria-label="Menu categories">
            {categories.map((category) => (
              <button
                className={activeCategory === category ? "active" : ""}
                key={category}
                onClick={() => setActiveCategory(category)}
                type="button"
              >
                <span>{category}</span>
                <b>{categoryCounts[category] || 0}</b>
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
              <button onClick={() => updateQuantity(item.slug, 1)} type="button">
                <span className="item-tag">{item.tag}</span>
                {quantities[item.slug] > 0 && (
                  <span className="item-count">{quantities[item.slug]}</span>
                )}
                <img className="menu-item-image" src={item.image} alt={item.name} width={0} height={0} />
                <strong>{item.name}</strong>
                <em>{item.nameInCreole}</em>
                <small>{item.note}</small>
                <b>{formatter.format(item.price)}</b>
              </button>
              <div className="quantity-control pos-quantity" aria-label={`${item.name} quantity`}>
                <button disabled={quantities[item.slug] === 0} onClick={() => updateQuantity(item.slug, -1)} type="button">
                  <Minus size={16} />
                </button>
                <strong>{quantities[item.slug]}</strong>
                <button onClick={() => updateQuantity(item.slug, 1)} type="button">
                  <Plus size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className={collapsed ? "pos-ticket is-collapsed" : "pos-ticket is-expanded"}>
        <div className="pos-ticket-header">
          <button
            aria-controls="order-ticket-body"
            aria-expanded={!collapsed}
            className="ticket-toggle"
            onClick={toggleTicket}
            type="button"
          >
            <span>
              <p className="eyebrow">{orderMode}</p>
              <h2>{collapsed ? formatter.format(total) : "Your order"}</h2>
              <small>{collapsed ? ticketSummary : "Review and send"}</small>
            </span>
            {collapsed ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
          </button>
          <button className="clear-ticket-button" disabled={totalItems === 0} onClick={clearTicket} type="button">
            Clear
          </button>
        </div>

        <div className="ticket-body" id="order-ticket-body">
          <div className={collapsed ? "ticket-lines is-collapsed" : "ticket-lines is-expanded"} aria-label="Order summary">
            {ticketItems.length === 0 ? (
              <div className="empty-ticket">
                <ShoppingBag size={34} />
                <p>No items added.</p>
              </div>
            ) : (
              ticketItems.map((item) => (
                <div className="ticket-line" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {quantities[item.slug]} x {formatter.format(item.price)}
                    </span>
                  </div>
                  <b>{formatter.format(quantities[item.slug] * item.price)}</b>
                </div>
              ))
            )}
          </div>

          <div className="payment-switch" aria-label="Payment preference">
            {["Pay in person", "Pay online"].map((type) => (
              <button
                className={paymentType === type ? "active" : ""}
                key={type}
                onClick={() => setPaymentType(type)}
                type="button"
              >
                {type}
              </button>
            ))}
          </div>

          <div className="ticket-total" aria-label="Order total">
            <span>
              Items
              <strong>{totalItems}</strong>
            </span>
            <span>
              Subtotal
              <strong>{formatter.format(subtotal)}</strong>
            </span>
            <span>
              Tax
              <strong>{formatter.format(tax)}</strong>
            </span>
            <span className="grand-total">
              Total
              <strong>{formatter.format(total)}</strong>
            </span>
          </div>

          {user ? (
            needsDeliveryAddress ? (
              <Link href="/account">
                <LockKeyhole size={18} />
                Add delivery address
              </Link>
            ) : (
              <button className="place-order-button" disabled={totalItems === 0 || submitting} onClick={placeOrder} type="button">
                <CheckCircle2 size={18} />
                {submitting ? "Sending order..." : "Place order"}
              </button>
            )
          ) : (
            <Link className={totalItems === 0 ? "disabled-link" : ""} href="/auth">
              <LockKeyhole size={18} />
              Sign in to continue
            </Link>
          )}
          {user && <small>Ordering as {user.email}</small>}
          {orderMode === "Delivery" && hasDeliveryAddress && (
            <small>
              Delivery to {user.addressLine1}, {user.city}
            </small>
          )}
          <small>
            Payment preference: {paymentType}
          </small>
          {status && (
            <p className={`form-status ${status.kind}`} role="status">
              {status.message}
            </p>
          )}
        </div>
      </aside>
    </section>
  );
}
