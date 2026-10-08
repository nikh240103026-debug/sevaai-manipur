"use client";

import { useEffect, useState } from "react";
import { fetchAllVillages } from "@/lib/village-data";
import type { Village } from "@/types/village";

export function useVillages() {
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllVillages(controller.signal)
      .then(setVillages)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load village data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { villages, loading, error };
}
