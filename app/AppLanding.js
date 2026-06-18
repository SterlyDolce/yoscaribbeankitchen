"use client";

import Link from "next/link";
import { MonitorSmartphone, Share, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import HomeScreen from "./HomeScreen";

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function detectDevice() {
  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const touchMac = platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  if (/iPhone|iPad|iPod/.test(userAgent) || touchMac) return "ios";
  if (/Android/.test(userAgent)) return "android";
  return "desktop";
}

const instructions = {
  ios: {
    icon: Share,
    label: "iPhone / iPad",
    steps: [
      "Open this page in Safari.",
      "Tap the Share button in the bottom toolbar.",
      "Scroll and tap Add to Home Screen.",
      "Tap Add. Then open Yo's from your home screen."
    ]
  },
  android: {
    icon: Smartphone,
    label: "Android",
    steps: [
      "Open this page in Chrome.",
      "Tap the three-dot menu.",
      "Tap Add to Home screen or Install app.",
      "Tap Add. Then open Yo's from your home screen."
    ]
  },
  desktop: {
    icon: MonitorSmartphone,
    label: "Desktop",
    steps: [
      "Open this page on your phone for the mobile app experience.",
      "Use Safari on iPhone or Chrome on Android.",
      "Add Yo's to your home screen from the browser menu."
    ]
  }
};

export default function AppLanding() {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [device, setDevice] = useState("desktop");
  const guide = useMemo(() => instructions[device], [device]);
  const Icon = guide.icon;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const syncState = () => {
      setStandalone(isStandaloneDisplay());
      setDevice(detectDevice());
      setReady(true);
    };

    syncState();
    mediaQuery.addEventListener("change", syncState);

    return () => mediaQuery.removeEventListener("change", syncState);
  }, []);

  if (!ready) {
    return (
      <main className="site app-install-site">
        <div className="app-install-card">
          <img src="/pwa-icon.png" alt="" width={86} height={86} />
          <p>Loading Yo&apos;s...</p>
        </div>
      </main>
    );
  }

  if (standalone) return <HomeScreen />;

  return (
    <main className="site app-install-site">
      <section className="app-install-card">
        <img src="/pwa-icon.png" alt="Yo's Caribbean Kitchen app icon" width={96} height={96} />
        <p className="eyebrow">Install Yo&apos;s app</p>
        <h1>Add Yo&apos;s to your home screen.</h1>
        <p className="app-install-copy">
          This page becomes the app home screen after you install it. No App Store needed.
        </p>

        <div className="app-device-pill">
          <Icon size={18} />
          <span>{guide.label}</span>
        </div>

        <ol className="app-install-steps">
          {guide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>

        <div className="app-install-actions">
          <Link className="app-home-primary" href="/">
            <Smartphone size={18} />
            Continue to website
          </Link>
        </div>
      </section>
    </main>
  );
}
