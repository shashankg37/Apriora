"use client";

import React, { useEffect, useState } from "react";
import { formatDate, stableDateLabel } from "@/lib/api";

/**
 * Prerender-safe timestamp: renders a locale-stable absolute date first and
 * upgrades to "42m ago" style labels after mount, so no `Date.now()` is read
 * while rendering (Next.js Cache Components forbids that).
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => stableDateLabel(iso));

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setLabel(formatDate(iso));
    });
    return () => cancelAnimationFrame(id);
  }, [iso]);

  return <span className={className}>{label}</span>;
}
