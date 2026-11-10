import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, runReconciliationScan } from "@/lib/db/store";
import { formatErrorResponse } from "@/lib/utils/errors";

export async function GET() {
  try {
    await getCurrentProfile();
    const state = getAemsState();
    return NextResponse.json({ data: state.reconciliation_findings });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST() {
  try {
    const profile = await getCurrentProfile();
    const findings = runReconciliationScan(profile);
    return NextResponse.json({ data: findings });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
