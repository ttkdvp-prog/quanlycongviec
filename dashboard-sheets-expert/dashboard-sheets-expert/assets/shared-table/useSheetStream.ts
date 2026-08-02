import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./apiClient";

type Status = "idle" | "loading" | "polling" | "error";

export function useSheetStream<T extends { id: string; version?: number; deleted?: boolean }>(
  table: string,
  opts: { intervalMs?: number; hiddenIntervalMs?: number } = {}
) {
  const interval = opts.intervalMs ?? 3000;
  const hiddenInterval = opts.hiddenIntervalMs ?? 30000;

  const [rows, setRows] = useState<T[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [lastVersion, setLastVersion] = useState(0);
  const timer = useRef<number | null>(null);
  const backoff = useRef(interval);

  const merge = useCallback((incoming: T[]) => {
    setRows(prev => {
      const map = new Map(prev.map(r => [r.id, r] as const));
      for (const r of incoming) {
        if (r.deleted) map.delete(r.id);
        else map.set(r.id, r);
      }
      return Array.from(map.values());
    });
  }, []);

  const seed = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await api.list<T>(table, { limit: 500 });
      setRows((res.data || []).filter(r => !r.deleted));
      if (res.version != null) setLastVersion(res.version);
      setStatus("polling");
      backoff.current = interval;
    } catch {
      setStatus("error");
    }
  }, [table, interval]);

  const tick = useCallback(async () => {
    try {
      const res = await api.stream<T>(table, lastVersion);
      if (res.data?.length) merge(res.data);
      if (res.version != null) setLastVersion(res.version);
      setStatus("polling");
      backoff.current = interval;
    } catch {
      backoff.current = Math.min(backoff.current * 2, 30000);
      setStatus("error");
    }
  }, [table, lastVersion, merge, interval]);

  useEffect(() => { void seed(); }, [seed]);

  useEffect(() => {
    function schedule() {
      const wait = document.visibilityState === "hidden" ? hiddenInterval : backoff.current;
      timer.current = window.setTimeout(async () => {
        await tick();
        schedule();
      }, wait);
    }
    if (status === "polling" || status === "error") schedule();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [tick, status, hiddenInterval]);

  useEffect(() => {
    function onVis() { if (document.visibilityState === "visible") void tick(); }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [tick]);

  return { rows, status, lastVersion, refetch: seed, merge };
}
