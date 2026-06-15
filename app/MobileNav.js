"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order" },
  { href: "/account", label: "Account" },
  { href: "/#visit", label: "Visit" }
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="nav-wrap">
      <button
        aria-controls="primary-menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="menu-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      <nav className={open ? "open" : ""} id="primary-menu" aria-label="Primary navigation">
        {links.map((link) => (
          <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
