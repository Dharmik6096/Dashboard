// lib/api.ts — Axios API client
import axios from "axios";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || "").replace(/\/$/, "");

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 60000,
  withCredentials: true,
});

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;

    // Only attempt token refresh on 401 Unauthorized
    if (status === 401 && typeof window !== "undefined" && !err.config?._retry) {
      err.config._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh || document.cookie !== undefined) {
        try {
          const res = await axios.post(`${API_URL}/api/v1/auth/refresh`, refresh ? { refresh_token: refresh } : {}, { withCredentials: true });
          if (localStorage.getItem("refresh_token")) {
            localStorage.setItem("access_token", res.data.access_token);
            localStorage.setItem("refresh_token", res.data.refresh_token);
          } else {
            sessionStorage.setItem("access_token", res.data.access_token);
          }
          err.config.headers.Authorization = `Bearer ${res.data.access_token}`;
          return api(err.config);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          sessionStorage.removeItem("access_token");
          if (!window.location.pathname.includes("/login")) {
            window.location.replace("/login");
          }
        }
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        sessionStorage.removeItem("access_token");
        window.location.replace("/login");
      }
    }

    // For all other errors, reject and let the caller handle it
    return Promise.reject(err);
  }
);

export const getWsUrl = (path: string = "") => {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("access_token") || "";
  const wsBase = WS_URL || `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${wsBase}/ws?token=${token}${path}`;
};

export default api;
