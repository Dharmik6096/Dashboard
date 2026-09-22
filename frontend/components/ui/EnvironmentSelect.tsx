"use client";
import { useState, useEffect, useCallback } from "react";
import { SearchableCombobox } from "./SearchableCombobox";
import api from "@/lib/api";

interface EnvironmentSelectProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  width?: number | string;
  allowAdd?: boolean;
}

/**
 * EnvironmentSelect — derives environments from the live servers list.
 * No hardcoded environment names. Uses server.environment from the API.
 * Case-insensitive deduplication; preserves canonical casing from DB.
 */
export function EnvironmentSelect({ value, onChange, label, width = 200, allowAdd = false }: EnvironmentSelectProps) {
  const [environments, setEnvironments] = useState<string[]>([]);

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await api.get("/servers");
      const servers: { environment: string }[] = Array.isArray(res.data) ? res.data : [];
      // Deduplicate case-insensitively, keep first encountered casing
      const seen = new Map<string, string>(); // lower → display
      for (const s of servers) {
        const env = (s.environment || "").trim();
        if (env && !seen.has(env.toLowerCase())) {
          seen.set(env.toLowerCase(), env);
        }
      }
      const envList = Array.from(seen.values()).sort();
      setEnvironments(envList);

      // If current value no longer matches any env (case-insensitively), clear it
      if (value && value.toLowerCase() !== "all environments") {
        const stillValid = envList.some(e => e.toLowerCase() === value.toLowerCase());
        if (!stillValid && envList.length > 0) {
          // Don't auto-clear — let user keep it; it will just return no results
        }
      }
    } catch {
      // If fetch fails, keep existing list
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const options = [
    { value: "All Environments", label: "All Environments" },
    ...environments.map(env => ({ value: env, label: env }))
  ];

  // Ensure current value is in options (e.g. user typed it manually before)
  if (value && value !== "All Environments") {
    const alreadyIn = options.some(o => o.value.toLowerCase() === value.toLowerCase());
    if (!alreadyIn) {
      options.push({ value, label: value });
    }
  }

  return (
    <SearchableCombobox
      value={value}
      options={options}
      onChange={onChange}
      placeholder="All Environments"
      width={width}
      label={label}
      allowAdd={allowAdd}
      onAdd={onChange}
    />
  );
}
