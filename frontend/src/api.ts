// Thin API client for Sehat Saathi backend.
const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL ?? "").replace(/\/$/, "") + "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getProfile: (deviceKey: string) => req<any>(`/profile/${deviceKey}`),
  upsertProfile: (p: any) => req<any>(`/profile`, { method: "POST", body: JSON.stringify(p) }),

  getContact: (deviceKey: string) => req<any>(`/emergency-contact/${deviceKey}`),
  setContact: (p: any) => req<any>(`/emergency-contact`, { method: "POST", body: JSON.stringify(p) }),
  deleteContact: (deviceKey: string) => req<any>(`/emergency-contact/${deviceKey}`, { method: "DELETE" }),

  listMedicines: (deviceKey: string) => req<any[]>(`/medicines?device_key=${encodeURIComponent(deviceKey)}`),
  getMedicine: (id: string) => req<any>(`/medicines/${id}`),
  createMedicine: (p: any) => req<any>(`/medicines`, { method: "POST", body: JSON.stringify(p) }),
  updateMedicine: (id: string, p: any) => req<any>(`/medicines/${id}`, { method: "PATCH", body: JSON.stringify(p) }),
  addSchedule: (id: string, p: any) => req<any>(`/medicines/${id}/schedule`, { method: "POST", body: JSON.stringify(p) }),
  discontinueMedicine: (id: string) => req<any>(`/medicines/${id}`, { method: "DELETE" }),

  scheduledDoses: (deviceKey: string, date: string) =>
    req<any[]>(`/scheduled-doses?device_key=${encodeURIComponent(deviceKey)}&date=${date}`),
  setDoseStatus: (p: any) => req<any>(`/scheduled-doses/status`, { method: "POST", body: JSON.stringify(p) }),

  calendar: (deviceKey: string, year: number, month: number) =>
    req<any[]>(`/calendar?device_key=${encodeURIComponent(deviceKey)}&year=${year}&month=${month}`),
  daily: (deviceKey: string, date: string) => req<any>(`/daily/${deviceKey}/${date}`),
  setDailyNote: (p: any) => req<any>(`/daily/note`, { method: "POST", body: JSON.stringify(p) }),

  scan: (p: { device_key: string; image_base64: string; mime_type?: string }) =>
    req<any>(`/scan`, { method: "POST", body: JSON.stringify(p) }),
  chat: (p: { device_key: string; message: string; language: string; session_id?: string }) =>
    req<{ text: string }>(`/assistant/chat`, { method: "POST", body: JSON.stringify(p) }),
};
