import { NextResponse } from "next/server";
import { sendReminders } from "@/lib/approvals";
import { rootSql } from "@/lib/db";
import { applyDueDelegations } from "@/lib/delegation";

/** Daily Vercel cron (see vercel.json). Protected by CRON_SECRET (Vercel sends it as a Bearer token). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const delegations = await applyDueDelegations();
  const sent = await sendReminders();
  await rootSql()`delete from sessions where expires_at < now()`;
  await rootSql()`delete from rate_limits where window_start < now() - interval '1 day'`;
  return NextResponse.json({ ok: true, reminders: sent, delegationsStarted: delegations });
}
