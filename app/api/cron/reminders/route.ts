import { NextResponse } from "next/server";
import { sendReminders } from "@/lib/approvals";
import { applyDueDelegations } from "@/lib/delegation";
import { housekeeping } from "@/lib/housekeeping";

/** Daily Vercel cron (see vercel.json). Protected by CRON_SECRET (Vercel sends it as a Bearer token). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const delegations = await applyDueDelegations();
  const sent = await sendReminders();
  const cleaned = await housekeeping();
  return NextResponse.json({ ok: true, reminders: sent, delegationsStarted: delegations, ...cleaned });
}
