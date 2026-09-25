"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Two-step destructive action: the first click arms it, the second confirms.
 * Avoids window.confirm so it works with keyboard, screen readers and embedded browsers.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  disabled = false,
  size,
}: {
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  size?: "xs" | "sm" | "default";
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="danger" size={size} disabled={disabled} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }

  return (
    <span role="group" aria-label={confirmLabel} className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="danger"
        size={size}
        disabled={disabled}
        autoFocus
        onClick={() => {
          setArmed(false);
          void onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="neutral" size={size} onClick={() => setArmed(false)}>
        Cancelar
      </Button>
      <span aria-live="polite" className="sr-only">
        Confirme para continuar ou cancele.
      </span>
    </span>
  );
}
