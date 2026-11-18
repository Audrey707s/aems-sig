import {beforeEach, describe, expect, it, vi} from "vitest";
import {getAemsState, manageUserProfile, resetAemsState} from "@/lib/db/store";
import {aemsRequestState} from "@/lib/db/context";
import {hasPermission} from "@/lib/permissions/rbac";

beforeEach(() => {vi.unstubAllEnvs(); resetAemsState();});
function fixture() {
  const state = getAemsState();
  return {state, admin: state.profiles.find(p => p.role === "ADMIN")!, user: state.profiles.find(p => p.role === "ACCOUNTING")!};
}
describe("Administrator assignment", () => {
  it("does not allow Staff to promote themselves or another user", () => {
    const {user, admin} = fixture();
    expect(() => manageUserProfile(user, {...user, role: "ADMIN"})).toThrow("Hanya Administrator");
    expect(() => manageUserProfile(user, {...admin, role: "ADMIN"})).toThrow("Hanya Administrator");
    expect(user.role).toBe("ACCOUNTING");
  });
  it("still requires verified email before granting administrator access", () => {
    const {state, user, admin} = fixture();
    vi.stubEnv("AEMS_STORAGE_MODE", "supabase");
    user.email_verified_at = null;
    expect(() => aemsRequestState.run({state}, () => manageUserProfile(admin, {...user, role: "ADMIN"}))).toThrow("Email pengguna harus diverifikasi");
    expect(user.role).toBe("ACCOUNTING");
  });
  it("does not orphan active Staff when their manager is promoted", () => {
    const {state, user, admin} = fixture();
    user.account_level = "MANAGER";
    state.profiles.push({...user, id: crypto.randomUUID(), email: "staff@example.test", account_level: "STAFF", manager_id: user.id});
    expect(() => manageUserProfile(admin, {...user, role: "ADMIN"})).toThrow("Pindahkan penempatan staff");
    expect(user.role).toBe("ACCOUNTING");
    expect(user.account_level).toBe("MANAGER");
  });
  it("promotes a manager without reports and keeps inactive accounts inactive", () => {
    const {user, admin} = fixture();
    user.account_level = "MANAGER";
    const updated = manageUserProfile(admin, {...user, role: "ADMIN", is_active: false});
    expect(updated.role).toBe("ADMIN");
    expect(updated.manager_id).toBeNull();
    expect(updated.account_level).toBe("STAFF");
    expect(hasPermission(updated, "users:manage")).toBe(false);
    manageUserProfile(admin, {...updated, is_active: true});
    expect(hasPermission(updated, "users:manage")).toBe(true);
  });
});
