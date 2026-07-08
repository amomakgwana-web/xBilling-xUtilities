const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface Envelope<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
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
};
