import { clearSession, getSession } from "./auth/session";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface Envelope<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSession()?.token;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    // Token missing/expired — drop the session and send the user back to
    // sign-in rather than surfacing a raw API error on every widget.
    clearSession();
    window.location.assign("/login");
    throw new Error("Session expired — please sign in again");
  }
  const body = (await res.json()) as Envelope<T>;
  if (!body.ok) {
    throw new Error(body.error?.message ?? `Request to ${path} failed`);
  }
  return body.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
};
