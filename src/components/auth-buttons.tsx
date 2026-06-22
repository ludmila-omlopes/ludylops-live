"use client";

import { getProviders, signIn, signOut, useSession } from "next-auth/react";
import { startTransition, useEffect, useState } from "react";

import { hasUsableAppSession } from "@/lib/auth/session-state";
import { GOOGLE_AUTHORIZATION_PARAMS } from "@/lib/auth/google";
import { Button } from "@/components/ui/button";

export function AuthButtons({ label = "Entrar com Google" }: { label?: string } = {}) {
  const { data: session } = useSession();
  const hasUsableSession = hasUsableAppSession(session);
  const protectionStatus = session?.user?.accountProtectionStatus ?? null;
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }> | null>(
    null,
  );

  useEffect(() => {
    startTransition(() => {
      getProviders().then((result) => {
        if (result) {
          setProviders(result);
        }
      });
    });
  }, []);

  if (hasUsableSession) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          variant="neutral"
          size="sm"
        >
          Sair
        </Button>
      </div>
    );
  }

  const hasGoogle = Boolean(providers?.google);
  const hasCredentials = Boolean(providers?.credentials);

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/" }, GOOGLE_AUTHORIZATION_PARAMS);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {hasGoogle ? (
          <Button type="button" onClick={handleGoogleSignIn}>
            {label}
          </Button>
        ) : null}
        {hasCredentials ? (
          <Button
            type="button"
            onClick={() => signIn("credentials", { email: "ana@example.com", callbackUrl: "/" })}
            variant="accent"
            size="sm"
          >
            Modo demo
          </Button>
        ) : null}
        {protectionStatus ? (
          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            variant="neutral"
            size="sm"
          >
            Limpar sessão
          </Button>
        ) : null}
      </div>
    </div>
  );
}
