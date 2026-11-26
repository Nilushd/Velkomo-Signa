/** Applies supabase/migrations/*.sql in order (tracked in schema_migrations). Usage: npm run db:migrate */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())`;
  const dir = path.join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const [done] = await sql`select 1 from schema_migrations where name = ${f}`;
    if (done) continue;
    console.log("applying", f);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(path.join(dir, f), "utf8"));
      await tx`insert into schema_migrations (name) values (${f})`;
    });
  }
  console.log("migrations up to date");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
