import api from "../api";

export interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_favorite: boolean;
  owner_id: string;
  layout: any[];
  widgets: any[];
  version: number;
  created_at: string;
  updated_at: string;
}

export const DashboardService = {
  list: async (): Promise<Dashboard[]> => {
    const res = await api.get("/dashboards");
    return res.data;
  },
  get: async (id: string): Promise<Dashboard> => {
    const res = await api.get(`/dashboards/${id}`);
    return res.data;
  },
  create: async (data: Partial<Dashboard>): Promise<Dashboard> => {
    const res = await api.post("/dashboards", data);
    return res.data;
  },
  update: async (id: string, data: Partial<Dashboard>): Promise<Dashboard> => {
    const res = await api.put(`/dashboards/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/dashboards/${id}`);
  }
};
