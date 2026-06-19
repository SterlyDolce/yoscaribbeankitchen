"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMenuItemSelections, getMenuItemUnitPrice } from "../menu-customizations";
import {
  orderBagStorageKey,
  readOrderBag,
  resolveBagLines,
  writeOrderBag
} from "../order/order-bag";

const orderModes = ["Pickup", "Delivery"];
const paymentTypes = ["Pay in person", "Pay online"];
const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

export default function ConfirmOrderForm({ menuItems, user }) {
  const searchParams = useSearchParams();
  const [bag, setBag] = useState([]);
  const [orderMode, setOrderMode] = useState(orderModes[0]);
  const [paymentType, setPaymentType] = useState(paymentTypes[0]);
  const [guestContact, setGuestContact] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    deliveryNotes: "",
    email: "",
    fullName: "",
    phone: "",
    postalCode: "",
    state: ""
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    const payment = searchParams.get("payment");
    const orderId = searchParams.get("order");

    if (payment === "success") {
      writeOrderBag([]);
      setBag([]);
      setStatus({
        kind: "success",
        message: orderId
          ? `Payment received for order ${orderId.slice(0, 8)}. Yo's will confirm timing.`
          : "Payment received. Yo's will confirm timing."
      });
    }

    if (payment === "cancelled") {
      setStatus({
        kind: "error",
        message: "Payment was cancelled. Your bag is still here if you want to try again."
      });
    }
  }, [searchParams]);

  const bagLines = useMemo(() => resolveBagLines(bag, menuItems), [bag, menuItems]);
  const totalItems = bagLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = bagLines.reduce(
    (total, line) => total + line.quantity * getMenuItemUnitPrice(line.item, line.selections),
    0
  );
  const serviceFee = totalItems > 0 ? 1.75 : 0;
  const deliveryFee = totalItems > 0 && orderMode === "Delivery" ? 1.25 : 0;
  const tax = subtotal * 0.07;
  const total = subtotal + tax + serviceFee + deliveryFee;
  const hasDeliveryAddress = Boolean(user?.addressLine1 && user?.city && user?.state && user?.postalCode);
  const needsDeliveryAddress = orderMode === "Delivery" && user && !hasDeliveryAddress;
  const needsGuestDetails = !user;

  function clearBag() {
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

  function buildOrderPayload() {
    return {
      fulfillmentMethod: orderMode,
      guestContact: user ? undefined : guestContact,
      items: bagLines.map((line) => ({
        instructions: line.instructions,
        quantity: line.quantity,
        selections: line.selections,
        slug: line.slug
      }))
    };
  }

  function updateGuestContact(field, value) {
    setGuestContact((current) => ({ ...current, [field]: value }));
  }

  async function placeOrder() {
    setSubmitting(true);
    setStatus(null);

    try {
      const payload = buildOrderPayload();
      const isOnlinePayment = paymentType === "Pay online";
      const response = await fetch(isOnlinePayment ? "/api/stripe/checkout" : "/api/orders", {
        body: JSON.stringify(
          isOnlinePayment
            ? payload
            : { ...payload, paymentPreference: paymentType }
        ),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "Unable to place order.");

      if (isOnlinePayment) {
        if (!result.url) throw new Error("Stripe did not return a checkout link.");
        window.location.href = result.url;
        return;
      }

      clearBag();
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
    <section className="confirm-order-page">
      <div className="confirm-order-heading">
        <p className="eyebrow">Checkout</p>
        <h1>Confirm your order</h1>
        <p>Review your bag, choose how you want to receive it, then pick your payment option.</p>
      </div>

      <div className="confirm-order-layout">
        <section className="confirm-order-card">
          <div className="confirm-section-header">
            <div>
              <p className="eyebrow">Your bag</p>
              <h2>{totalItems} {totalItems === 1 ? "item" : "items"}</h2>
            </div>
            <Link href="/menu">Add more</Link>
          </div>

          {bagLines.length === 0 ? (
            <div className="bag-empty-state">
              <ShoppingBag size={34} />
              <strong>Your bag is empty.</strong>
              <Link href="/menu">Browse menu</Link>
            </div>
          ) : (
            <div className="confirm-lines">
              {bagLines.map((line) => (
                <div className="bag-line" key={`${line.slug}-${line.lineIndex}`}>
                  <div>
                    <strong>{line.item.name}</strong>
                    <span>{line.quantity} x {formatter.format(getMenuItemUnitPrice(line.item, line.selections))}</span>
                    {formatMenuItemSelections(line.item, line.selections) && (
                      <small>{formatMenuItemSelections(line.item, line.selections)}</small>
                    )}
                    {line.instructions && <small>{line.instructions}</small>}
                    <Link href={`/order/${line.slug}`}>Customize another</Link>
                  </div>
                  <div className="bag-line-actions">
                    <b>{formatter.format(line.quantity * getMenuItemUnitPrice(line.item, line.selections))}</b>
                    <button aria-label={`Remove ${line.item.name}`} onClick={() => removeLine(line.lineIndex)} type="button">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="confirm-order-card confirm-checkout-card">
          <div className="confirm-section-header">
            <div>
              <p className="eyebrow">Details</p>
              <h2>Finish checkout</h2>
            </div>
          </div>

          <div className="confirm-choice-group">
            <span>How do you want it?</span>
            <div className="payment-switch" aria-label="Fulfillment method">
              {orderModes.map((mode) => (
                <button className={orderMode === mode ? "active" : ""} key={mode} onClick={() => setOrderMode(mode)} type="button">
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="confirm-choice-group">
            <span>Payment</span>
            <div className="payment-switch" aria-label="Payment preference">
              {paymentTypes.map((type) => (
                <button className={paymentType === type ? "active" : ""} key={type} onClick={() => setPaymentType(type)} type="button">
                  {type}
                </button>
              ))}
            </div>
          </div>

          {needsGuestDetails && (
            <div className="guest-checkout-fields">
              <div className="confirm-section-header">
                <div>
                  <p className="eyebrow">Guest checkout</p>
                  <h2>Your details</h2>
                </div>
              </div>
              <label>
                Full name
                <input autoComplete="name" onChange={(event) => updateGuestContact("fullName", event.target.value)} value={guestContact.fullName} />
              </label>
              <label>
                Email
                <input autoComplete="email" inputMode="email" onChange={(event) => updateGuestContact("email", event.target.value)} type="email" value={guestContact.email} />
              </label>
              <label>
                Phone
                <input autoComplete="tel" inputMode="tel" onChange={(event) => updateGuestContact("phone", event.target.value)} type="tel" value={guestContact.phone} />
              </label>

              {orderMode === "Delivery" && (
                <>
                  <label>
                    Address
                    <input autoComplete="address-line1" onChange={(event) => updateGuestContact("addressLine1", event.target.value)} value={guestContact.addressLine1} />
                  </label>
                  <label>
                    Apartment, suite, etc.
                    <input autoComplete="address-line2" onChange={(event) => updateGuestContact("addressLine2", event.target.value)} value={guestContact.addressLine2} />
                  </label>
                  <div className="guest-address-grid">
                    <label>
                      City
                      <input autoComplete="address-level2" onChange={(event) => updateGuestContact("city", event.target.value)} value={guestContact.city} />
                    </label>
                    <label>
                      State
                      <input autoComplete="address-level1" onChange={(event) => updateGuestContact("state", event.target.value)} value={guestContact.state} />
                    </label>
                    <label>
                      ZIP
                      <input autoComplete="postal-code" inputMode="numeric" onChange={(event) => updateGuestContact("postalCode", event.target.value)} value={guestContact.postalCode} />
                    </label>
                  </div>
                  <label>
                    Delivery notes
                    <textarea onChange={(event) => updateGuestContact("deliveryNotes", event.target.value)} value={guestContact.deliveryNotes} />
                  </label>
                </>
              )}
            </div>
          )}

          <div className="ticket-total" aria-label="Order total">
            <span>Items<strong>{totalItems}</strong></span>
            <span>Subtotal<strong>{formatter.format(subtotal)}</strong></span>
            <span>Tax<strong>{formatter.format(tax)}</strong></span>
            <span>Service Fee<strong>{formatter.format(serviceFee)}</strong></span>
            <span>Delivery Fee<strong>{formatter.format(deliveryFee)}</strong></span>
            <span className="grand-total">Total<strong>{formatter.format(total)}</strong></span>
          </div>

          {needsDeliveryAddress ? (
            <Link className="confirm-action-link" href="/account">
              Add delivery address
            </Link>
          ) : (
            <button className="place-order-button" disabled={totalItems === 0 || submitting} onClick={placeOrder} type="button">
              <CheckCircle2 size={18} />
              {submitting ? "Sending..." : paymentType === "Pay online" ? "Pay with Stripe" : "Place order"}
            </button>
          )}

          {user ? <small>Ordering as {user.email}</small> : <small>Checking out as guest</small>}
          {orderMode === "Delivery" && hasDeliveryAddress && <small>Delivery to {user.addressLine1}, {user.city}</small>}
          <small>Payment preference: {paymentType}</small>
          {status && <p className={`form-status ${status.kind}`} role="status">{status.message}</p>}
        </aside>
      </div>
    </section>
  );
}
