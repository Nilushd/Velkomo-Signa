import postgres from "postgres";

export type Sql = postgres.Sql<{}>;

declare global {
  // eslint-disable-next-line no-var
  var __signaSql: Sql | undefined;
}

function makeSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 5),
    prepare: false, // works with the Supabase transaction pooler
    idle_timeout: 20,
    transform: { undefined: null },
  });
}

/** Privileged connection. Only auth, public lookups and cron should use it directly. */
export function rootSql(): Sql {
  if (!globalThis.__signaSql) globalThis.__signaSql = makeSql();
  return globalThis.__signaSql;
}

export interface TenantCtx {
  propertyId: string;
  /** null = server/system scope inside the property (approval engine, admins) */
  userId?: string | null;
  isAdmin?: boolean;
}

/**
 * Run queries inside one transaction as role signa_app, with Row Level Security
 * limiting every table to this property (and, for normal users, to rows they may see).
 */
export async function tenant<T>(ctx: TenantCtx, fn: (tx: Sql) => Promise<T>): Promise<T> {
  const sql = rootSql();
  return (await sql.begin(async (tx) => {
    const t = tx as unknown as Sql;
    await t`select set_config('app.property_id', ${ctx.propertyId}, true),
                   set_config('app.user_id', ${ctx.userId ?? ""}, true),
                   set_config('app.is_admin', ${ctx.isAdmin ? "true" : "false"}, true)`;
    await t`set local role signa_app`;
    return fn(t);
  })) as T;
}

export function json(v: unknown) {
  return rootSql().json(v as postgres.JSONValue);
}
