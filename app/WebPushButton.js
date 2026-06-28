"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function WebPushButton({ className = "web-push-button" }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Enable order alerts");

  useEffect(() => {
    async function checkSupport() {
      const canUsePush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      setSupported(canUsePush);

      if (!canUsePush) return;

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();

      setEnabled(Boolean(subscription));
      setLabel(subscription ? "Order alerts on" : "Enable order alerts");
    }

    checkSupport();
  }, []);

  async function enableNotifications() {
    setBusy(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setLabel("Notifications blocked");
        return;
      }

      const keyResponse = await fetch("/api/web-push/public-key");
      const keyData = await keyResponse.json();

      if (!keyData.enabled || !keyData.publicKey) {
        setLabel("Alerts unavailable");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
        userVisibleOnly: true
      });

      const response = await fetch("/api/web-push/subscribe", {
        body: JSON.stringify({ subscription }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Unable to enable alerts.");
      }

      setEnabled(true);
      setLabel("Order alerts on");
    } catch (error) {
      console.error(error);
      setLabel("Alerts unavailable");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button className={className} disabled={busy || enabled} onClick={enableNotifications} type="button">
      {enabled ? <Bell size={17} /> : <BellOff size={17} />}
      {busy ? "Enabling..." : label}
    </button>
  );
}
