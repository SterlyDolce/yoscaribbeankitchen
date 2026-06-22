"use client";

import Link from "next/link";
import { Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem("yos-install-prompt-dismissed") === "true";
    if (!dismissed && !isStandaloneDisplay()) setVisible(true);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      if (!window.sessionStorage.getItem("yos-install-prompt-dismissed") && !isStandaloneDisplay()) {
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function dismissPrompt() {
    window.sessionStorage.setItem("yos-install-prompt-dismissed", "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="install-app-prompt" aria-label="Install Yo's app">
      <div className="install-app-prompt-icon">
        <Smartphone size={20} />
      </div>
      <div>
        <strong>Add Yo&apos;s to your home screen</strong>
        <span>Order faster from the app icon. No App Store needed.</span>
      </div>
      {deferredPrompt ? (
        <button className="install-app-prompt-action" onClick={installApp} type="button">
          Install
        </button>
      ) : (
        <Link className="install-app-prompt-action" href="/app">
          How
        </Link>
      )}
      <button className="install-app-prompt-close" onClick={dismissPrompt} type="button" aria-label="Dismiss install prompt">
        <X size={18} />
      </button>
    </aside>
  );
}
