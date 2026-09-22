"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";
import type { Server } from "@/types";

interface FilterContextType {
  envFilter: string;
  setEnvFilter: (env: string) => void;
  serverFilter: string;
  setServerFilter: (server: string) => void;
  servers: Server[];
  environments: string[];
  refreshData: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [envFilter, setEnvFilter] = useState("all");
  const [serverFilter, setServerFilter] = useState("all");
  const [servers, setServers] = useState<Server[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);

  const fetchServers = () => {
    api.get("/servers").then(res => {
      setServers(res.data);
      const envs = Array.from(new Set(res.data.map((s: Server) => s.environment || "Production"))).filter(Boolean) as string[];
      setEnvironments(envs);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchServers();
    
    // Load persisted state
    const savedEnv = localStorage.getItem("devops-env-filter");
    if (savedEnv) setEnvFilter(savedEnv);
    
    const savedServer = localStorage.getItem("devops-server-filter");
    if (savedServer) setServerFilter(savedServer);
  }, []);

  // Sync to local storage and handle environment changes
  const handleSetEnv = (env: string) => {
    setEnvFilter(env);
    localStorage.setItem("devops-env-filter", env);
    
    // If we changed env, and we have a specific server selected, check if it belongs to new env
    if (env !== "all" && serverFilter !== "all") {
      const serverDetails = servers.find(s => s.id === serverFilter);
      if (serverDetails && (serverDetails.environment || "Production") !== env) {
        setServerFilter("all");
        localStorage.setItem("devops-server-filter", "all");
      }
    }
  };

  const handleSetServer = (server: string) => {
    setServerFilter(server);
    localStorage.setItem("devops-server-filter", server);
  };

  return (
    <FilterContext.Provider value={{ 
      envFilter, 
      setEnvFilter: handleSetEnv, 
      serverFilter, 
      setServerFilter: handleSetServer, 
      servers, 
      environments,
      refreshData: fetchServers
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
