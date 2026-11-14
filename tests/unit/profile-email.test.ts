import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestEmailChange,
  profileSchema,
  emailChangeSchema,
} from "@/lib/auth/profile";
import {
  getAemsState,
  resetAemsState,
  updateOwnProfile,
  syncOwnVerifiedEmail,
} from "@/lib/db/store";
import { NextRequest } from "next/server";
const { auth, identity } = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
  identity: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));
vi.mock("@/lib/auth/personal-account", () => ({
  getSignedInProfile: identity,
}));
import { POST as email } from "@/app/api/v1/profile/email/route";
import { POST as passwordEmail } from "@/app/api/v1/profile/password-email/route";
const client = { auth } as unknown as SupabaseClient;
const request = (path: string, body: unknown, origin = "https://aems.test") =>
  new NextRequest(`https://aems.test${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.unstubAllEnvs();
  resetAemsState();
  vi.resetAllMocks();
  vi.stubEnv("AEMS_STORAGE_MODE", "hybrid");
  auth.getUser.mockResolvedValue({
    data: { user: { id: "own-user", email: "old@example.test" } },
    error: null,
  });
  auth.updateUser.mockResolvedValue({
    data: {
      user: {
        id: "own-user",
        email: "old@example.test",
        new_email: "new@example.test",
      },
    },
    error: null,
  });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  identity.mockResolvedValue({ id: "own-user", is_active: true });
});
describe("Personal profile and verified changes", () => {
  it("allows each role to edit only their own name while preserving authority", () => {
    const state = getAemsState();
    for (const p of state.profiles) {
      const before = {
        role: p.role,
        department: p.department,
        manager: p.manager_id,
        email: p.email,
      };
      updateOwnProfile(p, { full_name: "Nama Uji Profil" });
      expect({
        role: p.role,
        department: p.department,
        manager: p.manager_id,
        email: p.email,
      }).toEqual(before);
    }
    expect(state.audit_logs[0].action).toBe("UPDATE_OWN_PROFILE");
  });
  it("syncs only confirmed matching Auth identities and preserves role", () => {
    const p = getAemsState().profiles[0],
      role = p.role;
    expect(() =>
      syncOwnVerifiedEmail(p, { id: p.id, email: "new@example.test" }),
    ).toThrow(/terverifikasi/);
    expect(() =>
      syncOwnVerifiedEmail(p, {
        id: "different",
        email: "new@example.test",
        email_confirmed_at: "2026-11-14",
      }),
    ).toThrow(/terverifikasi/);
    syncOwnVerifiedEmail(p, {
      id: p.id,
      email: "new@example.test",
      email_confirmed_at: "2026-11-14",
    });
    expect(p.email).toBe("new@example.test");
    expect(p.role).toBe(role);
    expect(getAemsState().audit_logs[0].action).toBe("CONFIRM_EMAIL_CHANGE");
  });
  it("rejects authority fields, invalid names and malformed email", () => {
    expect(
      profileSchema.safeParse({ full_name: "Nama", role: "ADMIN" }).success,
    ).toBe(false);
    expect(profileSchema.safeParse({ full_name: " " }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ email: "not-email" }).success).toBe(
      false,
    );
    expect(
      emailChangeSchema.safeParse({ email: "a@b.test", id: "other" }).success,
    ).toBe(false);
  });
  it("rejects stale name edits and inactive identities", () => {
    const p = getAemsState().profiles[0];
    expect(() =>
      updateOwnProfile(p, {
        full_name: "Nama Baru",
        expected_updated_at: "old",
      }),
    ).toThrow(/berubah/);
    p.is_active = false;
    expect(() => updateOwnProfile(p, { full_name: "Nama Baru" })).toThrow(
      /Akses/,
    );
  });
  it("uses normal email confirmation, fixed callback and never changes profile email early", async () => {
    const before = structuredClone(getAemsState().profiles);
    const r = await requestEmailChange(
      client,
      "new@example.test",
      "https://aems.test",
    );
    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.test" },
      { emailRedirectTo: "https://aems.test/auth/email-change" },
    );
    expect(r.pending_email).toBe("new@example.test");
    expect(getAemsState().profiles).toEqual(before);
  });
  it("rejects unchanged email and missing auth", async () => {
    await expect(
      requestEmailChange(client, "OLD@example.test", "https://aems.test"),
    ).rejects.toThrow(/sama/);
    auth.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    await expect(
      requestEmailChange(client, "new@example.test", "https://aems.test"),
    ).rejects.toThrow(/login/);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects cross-origin email changes and disallowed payloads", async () => {
    expect(
      (
        await email(
          request(
            "/api/v1/profile/email",
            { email: "new@example.test" },
            "https://evil.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await email(
          request("/api/v1/profile/email", {
            email: "new@example.test",
            id: "someone",
          }),
        )
      ).status,
    ).toBe(400);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("sends password verification only to authenticated identity, ignoring supplied recipients", async () => {
    vi.stubEnv("AEMS_STORAGE_MODE", "supabase");
    const r = await passwordEmail(
      request("/api/v1/profile/password-email", {
        email: "attacker@example.test",
      }),
    );
    expect(r.status).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "old@example.test",
      { redirectTo: "https://aems.test/auth/recovery" },
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("reports email delivery errors instead of false success", async () => {
    vi.stubEnv("AEMS_STORAGE_MODE", "supabase");
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { status: 429 },
    });
    expect(
      (
        await email(
          request("/api/v1/profile/email", { email: "new@example.test" }),
        )
      ).status,
    ).toBe(429);
    auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 500 } });
    expect(
      (await passwordEmail(request("/api/v1/profile/password-email", {})))
        .status,
    ).toBe(503);
  });
  it("does not send sensitive changes for inactive accounts", async () => {
    identity.mockResolvedValue({ id: "own-user", is_active: false });
    expect(
      (
        await email(
          request("/api/v1/profile/email", { email: "new@example.test" }),
        )
      ).status,
    ).toBe(401);
    expect(
      (await passwordEmail(request("/api/v1/profile/password-email", {})))
        .status,
    ).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
