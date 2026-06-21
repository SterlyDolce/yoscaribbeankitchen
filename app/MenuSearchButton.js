"use client";

import { Search } from "lucide-react";

export default function MenuSearchButton({ className = "pwa-app-icon-button" }) {
  function focusMenuSearch() {
    const input = document.querySelector("[data-menu-search]");
    if (input instanceof HTMLInputElement) input.focus();
  }

  return (
    <button className={className} onClick={focusMenuSearch} type="button" aria-label="Search menu">
      <Search size={22} />
    </button>
  );
}
