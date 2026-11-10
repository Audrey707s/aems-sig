import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, submitMappingRequest } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { createMappingRequestSchema } from "@/lib/utils/schemas";

export async function GET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const state = getAemsState();
    const statusFilter = req.nextUrl.searchParams.get("status") || "";
    const scope = req.nextUrl.searchParams.get("scope") || ""; // "mine" | "all"

    let requests = [...state.mapping_change_requests];
    // Table 65: Non-admin sees own requests by default when scope="mine", or all for transparency in read
    if (scope === "mine" || profile.role !== "ADMIN") {
      if (scope === "mine") {
        requests = requests.filter((r) => r.requested_by === profile.id);
      }
    }
    if (statusFilter) {
      requests = requests.filter((r) => r.status === statusFilter);
    }

    return NextResponse.json({ data: requests });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const body = await req.json();
    const parsed = createMappingRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AemsError(
        "VALIDATION",
        parsed.error.issues.map((i) => i.message).join("; "),
        400
      );
    }
    const created = submitMappingRequest(profile, parsed.data);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
