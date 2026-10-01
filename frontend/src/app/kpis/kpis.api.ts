import { API_URL, apiFetch as authenticatedFetch } from '@/utils/api';
export const API_BASE = `${API_URL}/api`;
export async function apiFetch(path: string, signal?: AbortSignal) {
  const response = await authenticatedFetch(`${API_BASE}/kpis/${path}`, {
    signal,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join(", ")
        : body?.message ||
            `No se pudo consultar la API (HTTP ${response.status}).`,
    );
  }
  return response;
}
export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await apiFetch(path, signal)).json();
}
