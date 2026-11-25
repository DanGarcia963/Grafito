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

/** Escritura protegida por token; FormData conserva los binarios sin Content-Type manual. */
export async function post<T>(path: string, body: FormData | Record<string, unknown>): Promise<T> {
  const form = body instanceof FormData;
  const response = await authenticatedFetch(`${API_BASE}/kpis/${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    ...(form ? {} : { headers: { "Content-Type": "application/json" } }),
    body: form ? body : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success === false) {
    throw new Error(Array.isArray(result?.message)
      ? result.message.join(", ")
      : result?.message || "No se pudo guardar el resultado histórico.");
  }
  return result as T;
}
