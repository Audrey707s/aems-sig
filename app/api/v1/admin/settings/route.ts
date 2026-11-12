import { withAemsPersistence } from "@/lib/db/persistence";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getAemsState, updateAppSettings } from "@/lib/db/store";
import { AemsError, formatErrorResponse } from "@/lib/utils/errors";
import { hasPermission } from "@/lib/permissions/rbac";

async function handleGET() {
  try {
    const profile = await getCurrentProfile();
    if (!hasPermission(profile, "settings:manage")) {
      throw new AemsError(
        "FORBIDDEN",
        "Hanya Administrator yang memiliki wewenang melihat halaman konfigurasi sistem.",
        403
      );
    }
    const state = getAemsState();
    return NextResponse.json({
      data: state.app_settings,
      references: {
        asset_categories: state.asset_categories,
        equipment_categories: state.equipment_categories,
        locations: state.locations,
      },
    });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    const body = await req.json();
    const updated = updateAppSettings(profile, body);
    return NextResponse.json({ data: updated });
  } catch (err) {
    const formatted = formatErrorResponse(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

async function handlePATCH(req: NextRequest) {
  return PUT(req);
}

export const GET = withAemsPersistence(handleGET);

export const PUT = withAemsPersistence(handlePUT);

export const PATCH = withAemsPersistence(handlePATCH);
