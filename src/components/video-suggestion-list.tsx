"use client";

import { useEffect, useState } from "react";

import { VideoSuggestionCard } from "@/components/video-suggestion-card";
import type { VideoSuggestionWithMeta } from "@/lib/types";

export function VideoSuggestionList({
  suggestions,
  loggedIn = false,
  canInteract = false,
  viewerBalance,
}: {
  suggestions: VideoSuggestionWithMeta[];
  loggedIn?: boolean;
  canInteract?: boolean;
  viewerBalance?: number | null;
}) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localBalance, setLocalBalance] = useState<number | null>(viewerBalance ?? null);

  useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  useEffect(() => {
    setLocalBalance(viewerBalance ?? null);
  }, [viewerBalance]);

  function handleBoostSuccess(updatedSuggestion: VideoSuggestionWithMeta, spentAmount: number) {
    setLocalSuggestions((current) =>
      current.map((suggestion) =>
        suggestion.id === updatedSuggestion.id ? updatedSuggestion : suggestion,
      ),
    );

    setLocalBalance((current) =>
      typeof current === "number" ? Math.max(current - spentAmount, 0) : current,
    );
  }

  const sorted = [...localSuggestions].sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) {
      return b.totalVotes - a.totalVotes;
    }

    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  const visibleSuggestions = sorted.filter((suggestion) => suggestion.status !== "rejected");

  return (
    <div className="grid gap-4">
      {visibleSuggestions.map((suggestion, index) => (
        <VideoSuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          index={index}
          loggedIn={loggedIn}
          canBoost={canInteract}
          viewerBalance={localBalance}
          onBoostSuccess={handleBoostSuccess}
        />
      ))}
    </div>
  );
}
