import { getFingerprint } from "../utils/deviceFingerprint";

const BASE_URL = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Fingerprint": getFingerprint(),
    "Cache-Control": "no-cache, no-store",
    "Pragma": "no-cache",
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    const error: any = new Error(data.message || "请求失败");
    error.code = data.code || "UNKNOWN";
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return request<T>(`${path}${sep}_=${Date.now().toString(36)}`);
  },
  post: <T>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
