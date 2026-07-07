"use client";

import { getProviders, signIn } from "next-auth/react";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GOOGLE_AUTHORIZATION_PARAMS } from "@/lib/auth/google";

const CREATOR_AREA_CALLBACK_URL = "/criar-area";

export function CreatorLandingCta() {
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

  const hasGoogle = Boolean(providers?.google);
  const hasCredentials = Boolean(providers?.credentials);

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: CREATOR_AREA_CALLBACK_URL }, GOOGLE_AUTHORIZATION_PARAMS);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {hasGoogle ? (
          <Button type="button" onClick={handleGoogleSignIn} variant="accent">
            Criar a minha área
          </Button>
        ) : null}
        {hasCredentials ? (
          <Button
            type="button"
            onClick={() =>
              signIn("credentials", { email: "ana@example.com", callbackUrl: CREATOR_AREA_CALLBACK_URL })
            }
            variant="accent"
            size="sm"
          >
            Modo demo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
