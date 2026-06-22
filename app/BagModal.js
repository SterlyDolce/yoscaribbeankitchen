"use client";

import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMenuItemSelections, getMenuItemUnitPrice } from "./menu-customizations";
import {
  openOrderBagEventName,
  orderBagStorageKey,
  readOrderBag,
  resolveBagLines,
  writeOrderBag
} from "./order/order-bag";

const formatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency"
});

export default function BagModal() {
  const [open, setOpen] = useState(false);
  const [bag, setBag] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [bagDataLoaded, setBagDataLoaded] = useState(false);

  useEffect(() => {
    const syncBag = () => setBag(readOrderBag());
    const syncStorage = (event) => {
      if (!event.key || event.key === orderBagStorageKey) syncBag();
    };
    const handleOpen = () => {
      syncBag();
      setOpen(true);
    };

    syncBag();
    window.addEventListener("order-bag-change", syncBag);
    window.addEventListener("storage", syncStorage);
    window.addEventListener(openOrderBagEventName, handleOpen);

    return () => {
      window.removeEventListener("order-bag-change", syncBag);
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener(openOrderBagEventName, handleOpen);
    };
  }, []);

  useEffect(() => {
    if (!open || bagDataLoaded) return;

    let cancelled = false;
    setLoadingData(true);

    fetch("/api/bag-data")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setMenuItems(data.menuItems || []);
        setBagDataLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMenuItems([]);
        setUser(null);
        setBagDataLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bagDataLoaded, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const bagLines = useMemo(() => resolveBagLines(bag, menuItems), [bag, menuItems]);
  const totalItems = bagLines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = bagLines.reduce(
    (total, line) => total + line.quantity * getMenuItemUnitPrice(line.item, line.selections),
    0
  );
  const serviceFee = totalItems > 0 ? 1.75 : 0;
  const tax = subtotal * 0.07;
  const total = serviceFee + subtotal + tax;

  function clearBag() {
    writeOrderBag([]);
    setBag([]);
  }

  function removeLine(lineIndex) {
    const nextBag = bag.filter((_, index) => index !== lineIndex);
    writeOrderBag(nextBag);
    setBag(nextBag);
  }

  function updateLineQuantity(lineIndex, quantity) {
    if (quantity <= 0) {
      removeLine(lineIndex);
      return;
    }

    const nextBag = bag.map((line, index) => (
      index === lineIndex ? { ...line, quantity } : line
    ));

    writeOrderBag(nextBag);
    setBag(nextBag);
  }

  if (!open) return null;

  return (
    <div className="bag-modal-backdrop" role="dialog" aria-modal="true" aria-label="Your bag">
      <div className="bag-modal">
        <div className="bag-modal-header">
          <div>
            <p className="eyebrow">Review bag</p>
            <h2>Your bag</h2>
            <span>{totalItems} {totalItems === 1 ? "item" : "items"}</span>
          </div>
          <button aria-label="Close bag" className="bag-close-button" onClick={() => setOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="bag-modal-body">
          {loadingData ? (
            <div className="bag-empty-state">
              <ShoppingBag size={34} />
              <strong>Loading your bag...</strong>
            </div>
          ) : bagLines.length === 0 ? (
            <div className="bag-empty-state">
              <ShoppingBag size={34} />
              <strong>Your bag is empty.</strong>
              <Link href="/menu" onClick={() => setOpen(false)}>Browse menu</Link>
            </div>
          ) : (
            <>
              <div className="bag-line-list">
                {bagLines.map((line) => (
                  <div className="bag-line" key={`${line.slug}-${line.lineIndex}`}>
                    <div>
                      <strong>{line.item.name}</strong>
                      <span>{line.quantity} x {formatter.format(getMenuItemUnitPrice(line.item, line.selections))}</span>
                      {formatMenuItemSelections(line.item, line.selections) && (
                        <small>{formatMenuItemSelections(line.item, line.selections)}</small>
                      )}
                      {line.instructions && <small>{line.instructions}</small>}
                      <Link href={`/menu/${line.slug}`} onClick={() => setOpen(false)}>Customize another</Link>
                    </div>
                    <div className="bag-line-actions">
                      <b>{formatter.format(line.quantity * getMenuItemUnitPrice(line.item, line.selections))}</b>
                      <div className="bag-quantity-control" aria-label={`${line.item.name} quantity`}>
                        <button aria-label={`Decrease ${line.item.name} quantity`} onClick={() => updateLineQuantity(line.lineIndex, line.quantity - 1)} type="button">
                          -
                        </button>
                        <strong>{line.quantity}</strong>
                        <button aria-label={`Increase ${line.item.name} quantity`} onClick={() => updateLineQuantity(line.lineIndex, line.quantity + 1)} type="button">
                          +
                        </button>
                      </div>
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
            </>
          )}
        </div>

        <div className="bag-modal-footer">
          <button className="clear-ticket-button" disabled={totalItems === 0} onClick={clearBag} type="button">Clear</button>
          <Link className={totalItems === 0 ? "bag-checkout-link disabled-link" : "bag-checkout-link"} href="/checkout" onClick={() => setOpen(false)}>
            Checkout
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
