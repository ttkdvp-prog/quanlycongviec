const URL = (import.meta as any).env?.VITE_APPS_SCRIPT_URL as string;
const KEY = (import.meta as any).env?.VITE_API_KEY as string;

type Envelope<T> = { ok: boolean; data: T; error: string | null; version?: number; total?: number };

async function call<T>(method: "GET" | "POST", payload: Record<string, unknown>): Promise<Envelope<T>> {
  const body = { ...payload, apiKey: KEY };
  let res: Response;
  if (method === "GET") {
    const params = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v == null) return;
      params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    });
    res = await fetch(`${URL}?${params.toString()}`, { method: "GET" });
  } else {
    res = await fetch(URL, {
      method: "POST",
      // text/plain avoids the CORS preflight Apps Script does not handle.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
  }
  const json = (await res.json()) as Envelope<T>;
  if (!json.ok) throw new Error(json.error || "request failed");
  return json;
}

export const api = {
  list: <T>(table: string, args: { q?: string; sort?: string; offset?: number; limit?: number } = {}) =>
    call<T[]>("GET", { action: "list", table, ...args }),
  get: <T>(table: string, id: string) => call<T>("GET", { action: "get", table, id }),
  create: <T>(table: string, data: Partial<T>) => call<T>("POST", { action: "create", table, data }),
  update: <T>(table: string, id: string, data: Partial<T>) => call<T>("POST", { action: "update", table, id, data }),
  remove: (table: string, id: string) => call<{ id: string; deleted: true }>("POST", { action: "delete", table, id }),
  stream: <T>(table: string, since: number) => call<T[]>("GET", { action: "stream", table, since }),
};
