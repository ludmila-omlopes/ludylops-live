"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function RefreshButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button type="button" variant="neutral" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
