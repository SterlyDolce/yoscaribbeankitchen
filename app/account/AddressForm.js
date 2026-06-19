"use client";

import { MapPin, Pencil } from "lucide-react";
import { useState } from "react";

export default function AddressForm({ user }) {
  const hasAddress = Boolean(user.addressLine1 && user.city && user.state && user.postalCode);
  const [editing, setEditing] = useState(!hasAddress);
  const [form, setForm] = useState({
    addressLine1: user.addressLine1 || "",
    addressLine2: user.addressLine2 || "",
    city: user.city || "",
    deliveryNotes: user.deliveryNotes || "",
    postalCode: user.postalCode || "",
    state: user.state || ""
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
    setStatus(null);
  }

  async function saveAddress(event) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/account/profile", {
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to save address.");
      }

      setStatus({ kind: "success", message: "Delivery address saved." });
      setEditing(false);
    } catch (error) {
      setStatus({ kind: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  const addressLines = [
    form.addressLine1,
    form.addressLine2,
    form.city && form.state && form.postalCode ? `${form.city}, ${form.state} ${form.postalCode}` : ""
  ].filter(Boolean);

  if (!editing) {
    return (
      <button className="address-edit-card" onClick={() => setEditing(true)} type="button">
        <span className="address-edit-icon">
          <MapPin size={20} />
        </span>
        <span>
          <small>Delivery address</small>
          {addressLines.map((line) => <strong key={line}>{line}</strong>)}
          {form.deliveryNotes && <em>{form.deliveryNotes}</em>}
        </span>
        <Pencil size={18} />
      </button>
    );
  }

  return (
    <form className="address-form" onSubmit={saveAddress}>
      <div className="profile-section-heading">
        <p className="eyebrow">Delivery address</p>
        <h2>Where should Yo&apos;s deliver?</h2>
        <span>Required only when you choose delivery at checkout.</span>
      </div>

      <label>
        Street address
        <input autoComplete="address-line1" name="addressLine1" onChange={updateField} required value={form.addressLine1} />
      </label>
      <label>
        Apt, suite, floor
        <input autoComplete="address-line2" name="addressLine2" onChange={updateField} value={form.addressLine2} />
      </label>
      <div className="address-grid">
        <label>
          City
          <input autoComplete="address-level2" name="city" onChange={updateField} required value={form.city} />
        </label>
        <label>
          State
          <input autoComplete="address-level1" name="state" onChange={updateField} required value={form.state} />
        </label>
        <label>
          ZIP
          <input autoComplete="postal-code" name="postalCode" onChange={updateField} required value={form.postalCode} />
        </label>
      </div>
      <label>
        Delivery notes
        <textarea
          name="deliveryNotes"
          onChange={updateField}
          placeholder="Gate code, side door, call when outside..."
          rows={3}
          value={form.deliveryNotes}
        />
      </label>
      <div className="address-form-actions">
        <button disabled={saving} type="submit">{saving ? "Saving..." : "Save delivery address"}</button>
        {hasAddress && (
          <button className="address-cancel-button" disabled={saving} onClick={() => setEditing(false)} type="button">
            Cancel
          </button>
        )}
      </div>
      {status && <p className={`form-status ${status.kind}`} role="status">{status.message}</p>}
    </form>
  );
}
