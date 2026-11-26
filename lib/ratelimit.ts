import { headers } from "next/headers";
import { rootSql } from "./db";

/** Fixed-window counter in Postgres. Returns false when the limit is exceeded. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [r] = await rootSql()<{ count: number }[]>`
    insert into rate_limits (key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count`;
  return r.count <= limit;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}
