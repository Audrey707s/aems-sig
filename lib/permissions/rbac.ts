// =============================================================================
// Role-Based Access Control (RBAC) Matrix Enforcement (Blueprint R.02 Bab 20.2)
// =============================================================================

import { AppRole, ImportType, Profile } from "@/lib/types/domain";

export type PermissionAction =
  | "asset:read"
  | "asset:write"
  | "equipment:read"
  | "equipment:write"
  | "spec:write"
  | "mapping:request"
  | "mapping:approve"
  | "import:asset"
  | "import:equipment"
  | "import:mapping"
  | "import:view_all"
  | "report:read"
  | "report:export"
  | "audit:view_full"
  | "reconciliation:read"
  | "reconciliation:resolve"
  | "users:manage"
  | "settings:manage";

const ROLE_PERMISSIONS: Record<AppRole, Set<PermissionAction>> = {
  ACCOUNTING: new Set([
    "asset:read",
    "asset:write",
    "equipment:read",
    "mapping:request",
    "import:asset",
    "import:mapping",
    "report:read",
    "report:export",
    "reconciliation:read",
  ]),
  MAINTENANCE: new Set([
    "asset:read",
    "equipment:read",
    "equipment:write",
    "spec:write",
    "mapping:request",
    "import:equipment",
    "import:mapping",
    "report:read",
    "report:export",
    "reconciliation:read",
  ]),
  ADMIN: new Set([
    "asset:read",
    "asset:write",
    "equipment:read",
    "equipment:write",
    "spec:write",
    "mapping:request",
    "mapping:approve",
    "import:asset",
    "import:equipment",
    "import:mapping",
    "import:view_all",
    "report:read",
    "report:export",
    "audit:view_full",
    "reconciliation:read",
    "reconciliation:resolve",
    "users:manage",
    "settings:manage",
  ]),
};

/**
 * Checks whether a user profile is active and has the requested permission.
 * Enforces BR-AC-05 (inactive users cannot read or write even if token exists)
 * and BR-AC-06 (users without assigned role have no access).
 */
export function hasPermission(
  profile: Pick<Profile, "role" | "is_active"> | null | undefined,
  action: PermissionAction
): boolean {
  if (!profile || !profile.is_active || !profile.role) {
    return false;
  }
  const allowed = ROLE_PERMISSIONS[profile.role];
  return allowed ? allowed.has(action) : false;
}

/**
 * Checks whether a user profile is allowed to run a given import type (Table 58 & Table 68).
 */
export function canRunImportType(
  profile: Pick<Profile, "role" | "is_active"> | null | undefined,
  importType: ImportType
): boolean {
  if (!profile || !profile.is_active || !profile.role) return false;
  if (importType === "ASSET_MASTER") return hasPermission(profile, "import:asset");
  if (importType === "EQUIPMENT_MASTER") return hasPermission(profile, "import:equipment");
  if (importType === "MAPPING") return hasPermission(profile, "import:mapping");
  return false;
}

export function getRoleLabel(role: AppRole | null | undefined): string {
  switch (role) {
    case "ACCOUNTING":
      return "Accounting";
    case "MAINTENANCE":
      return "Maintenance / Operasional";
    case "ADMIN":
      return "Administrator";
    default:
      return "Belum Ada Role";
  }
}

export function getRoleBadgeColor(role: AppRole | null | undefined): string {
  switch (role) {
    case "ACCOUNTING":
      return "bg-[#E8EEF7] text-[#1A3263] border-[#547792]/30";
    case "MAINTENANCE":
      return "bg-[#FEF6E7] text-[#8A580C] border-[#FAB95B]/50";
    case "ADMIN":
      return "bg-[#1A3263] text-white border-[#1A3263]";
    default:
      return "bg-[#E8E2DB] text-[#1A3263] border-[#547792]/30";
  }
}
