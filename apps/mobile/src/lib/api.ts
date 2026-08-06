import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** API sunucusunun portu — .env içindeki PORT ile aynı olmalı. */
const API_PORT = 4100;

/**
 * API adresi çözümü:
 *  1. app.json > extra.apiUrl
 *  2. Expo Go'da telefon "localhost"u kendi cihazı sanar; bu yüzden
 *     geliştirme sunucusunun LAN IP'sini otomatik kullanırız.
 */
function resolveApiUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

  const isLocalhost = !configured || /localhost|127\.0\.0\.1/.test(configured);
  if (!isLocalhost) return configured!;

  if (Platform.OS === "android" && !Constants.expoConfig?.hostUri) {
    // Android emülatöründe ana makine 10.0.2.2 adresidir.
    return `http://10.0.2.2:${API_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:${API_PORT}`;

  return configured ?? `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const API_BASE = `${API_URL}/api/v1`;

/** Web arayüzünün adresi — paylaşılan bağlantılar buraya işaret eder. */
export const WEB_URL =
  (Constants.expoConfig?.extra as { webUrl?: string } | undefined)?.webUrl ?? "";

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

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokens = {
  access: () => accessToken,
  async load() {
    accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    return { accessToken, refreshToken };
  },
  async set(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined);
  },
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  if (!refreshToken) return false;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await tokens.clear();
        return false;
      }
      const data = (await response.json()) as { accessToken: string; refreshToken: string };
      await tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
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
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, _retried, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) finalHeaders["Content-Type"] = "application/json";
  if (auth && accessToken) finalHeaders.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (response.status === 401 && auth && !_retried) {
    if (await refreshAccessToken()) return apiFetch<T>(path, { ...options, _retried: true });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const payload = data as {
      error?: { code: string; message: string; fields?: Record<string, string> };
    };
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

/** Cihazdan seçilen görseli yükler. */
export async function uploadImageAsset(
  uri: string,
  preset: "avatar" | "cover" | "post" | "message" = "post",
) {
  const name = uri.split("/").pop() ?? "image.jpg";
  const extension = name.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

  const form = new FormData();
  form.append("preset", preset);
  // React Native'in FormData dosya biçimi
  form.append("file", { uri, name, type: mime } as unknown as Blob);

  return apiFetch<{ url: string; type: "IMAGE"; width: number; height: number; size: number }>(
    "/upload/image",
    { method: "POST", body: form },
  );
}
