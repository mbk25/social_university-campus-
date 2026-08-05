"use client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
export const API_BASE = `${API_URL}/api/v1`;

const ACCESS_KEY = "kampus.access";
const REFRESH_KEY = "kampus.refresh";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------- jetonlar
export const tokens = {
  access: () => (typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("kampus:auth-changed"));
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event("kampus:auth-changed"));
  },
};

/** Aynı anda birden fazla 401 gelirse tek bir yenileme isteği yapılır. */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = tokens.refresh();
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        tokens.clear();
        return false;
      }
      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Sonraki çağrılar yeni bir yenileme başlatabilsin.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  /** İç kullanım: sonsuz yenileme döngüsünü engeller. */
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, _retried, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) finalHeaders.set("Content-Type", "application/json");

  if (auth) {
    const token = tokens.access();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 401 && auth && !_retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, { ...options, _retried: true });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const payload = data as { error?: { code: string; message: string; fields?: Record<string, string> } };
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "UNKNOWN",
      payload?.error?.message ?? "Bir hata oluştu",
      payload?.error?.fields,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

/** Görsel/dosya yükleme yardımcı fonksiyonları. */
export async function uploadImage(
  file: File,
  preset: "avatar" | "cover" | "post" | "message" = "post",
) {
  const form = new FormData();
  form.append("preset", preset);
  form.append("file", file);
  return apiFetch<{ url: string; type: "IMAGE"; width: number; height: number; size: number; name: string }>(
    "/upload/image",
    { method: "POST", body: form },
  );
}

export async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ url: string; type: "IMAGE" | "FILE"; name: string; size: number }>("/upload/file", {
    method: "POST",
    body: form,
  });
}
