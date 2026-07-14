import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "../api/client";
import { FALLBACK_CONFIG, type AppConfig } from "./types";

export const configKeys = { all: ["config"] as const };

export const getConfig = () => apiRequest<AppConfig>("/config");

// Returns runtime config with a documented fallback so consumers (Top K slider,
// upload validation) always have usable values, even while loading or on error.
export function useConfig(): AppConfig {
  const query = useQuery({ queryKey: configKeys.all, queryFn: getConfig, staleTime: Infinity });
  return query.data ?? FALLBACK_CONFIG;
}
