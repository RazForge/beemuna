"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002/api/v1";

const TOKEN_KEY = "beemuna_token";

let currentToken: string | null = null;

export function setToken(token: string | null) {
  currentToken = token;
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (!currentToken) currentToken = sessionStorage.getItem(TOKEN_KEY);
  return currentToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T>(
  path: string,
  { method = "GET", body, headers, signal }: RequestOptions = {},
): Promise<T> {
  const token = getToken();
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const url = `${API_URL}${path}`;
  console.log(`[API] ${method} ${url}`, {
    API_URL,
    path,
    fullUrl: url,
    token: !!token,
    isFormData,
    origin: typeof window !== "undefined" ? window.location.origin : "server",
    protocol: typeof window !== "undefined" ? window.location.protocol : "unknown",
  });
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
      signal,
      credentials: "include",
    });

    if (response.status === 401 && token) {
      setToken(null);
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        if (typeof data?.detail === "string") message = data.detail;
        else if (Array.isArray(data?.detail) && data.detail.length > 0) {
          message = data.detail
            .map((d: { msg?: string }) => d.msg ?? "")
            .filter(Boolean)
            .join("; ");
        }
      } catch {
        // keep default message
      }
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[API] ${method} ${url} failed:`, error);
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      console.error("[API] Network error details:", {
        API_URL,
        path,
        fullUrl: url,
        tokenPresent: !!token,
        isHttps: typeof window !== "undefined" && window.location.protocol === "https:",
        frontendOrigin: typeof window !== "undefined" ? window.location.origin : "unknown",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      });
      console.error("[API] Troubleshooting: check that the backend is running, CORS allows the frontend origin, and there are no browser extensions/firewall blocking the request.");
    }
    throw error;
  }
}

export const apiGet = <T,>(path: string, signal?: AbortSignal) =>
  api<T>(path, { signal });
export const apiPost = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });
export const apiPatch = <T,>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body });
export const apiDelete = <T,>(path: string) =>
  api<T>(path, { method: "DELETE" });
