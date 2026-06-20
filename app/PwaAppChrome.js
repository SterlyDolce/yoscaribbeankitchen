"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BagButton from "./BagButton";

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function getTitle(pathname) {
  if (pathname.startsWith("/menu/")) return "Customize";
  if (pathname.startsWith("/order/")) return "Customize";
  if (pathname.startsWith("/order")) return "Order";
  if (pathname.startsWith("/confirm-order")) return "Checkout";
  if (pathname.startsWith("/menu")) return "Menu";
  if (pathname.startsWith("/account")) return "Account";
  if (pathname.startsWith("/auth")) return "Sign in";
  return "Yo's";
}

export default function PwaAppChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);
  const [appExperience, setAppExperience] = useState(false);
  const title = useMemo(() => getTitle(pathname || ""), [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const syncState = () => {
      const isStandalone = isStandaloneDisplay();
      const isAppEntry = pathname === "/app";

      setStandalone(isStandalone);

      if (isStandalone && isAppEntry) {
        window.sessionStorage.setItem("yos-pwa-app", "true");
      }

      setAppExperience(isStandalone && window.sessionStorage.getItem("yos-pwa-app") === "true");
    };

    syncState();
    mediaQuery.addEventListener("change", syncState);

    return () => mediaQuery.removeEventListener("change", syncState);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-yos-pwa", standalone && appExperience);
    return () => document.documentElement.removeAttribute("data-yos-pwa");
  }, [appExperience, standalone]);

  if (!standalone || !appExperience || pathname === "/app") return null;

  return (
    <header className="pwa-app-header" aria-label="Yo's app navigation">
      <button className="pwa-app-icon-button" onClick={() => router.back()} type="button" aria-label="Go back">
        <ChevronLeft size={32} />
      </button>

      <Link className="pwa-app-title" href="/app" aria-label="Yo's app home">
        <span>{title}</span>
      </Link>

      <div className="pwa-app-actions">
        <BagButton className="pwa-app-icon-button" />
      </div>
    </header>
  );
}
