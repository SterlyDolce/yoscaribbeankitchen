"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function signOut() {
    setSubmitting(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth");
    router.refresh();
  }

  return (
    <button disabled={submitting} onClick={signOut} type="button">
      <LogOut size={18} />
      {submitting ? "Signing out..." : "Sign out"}
    </button>
  );
}
