"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function ModalCloseButton() {
  const router = useRouter();

  return (
    <button
      aria-label="Close"
      className="bag-close-button modal-customize-back-link"
      onClick={() => router.back()}
      type="button"
    >
      <X size={20} />
    </button>
  );
}
