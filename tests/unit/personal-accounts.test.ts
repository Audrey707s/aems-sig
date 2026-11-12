import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { passwordChangeSchema, registrationSchema } from "@/lib/auth/account-schemas";
import { changeOwnPassword } from "@/lib/auth/personal-account";
import { getAemsState, manageUserProfile, resetAemsState } from "@/lib/db/store";
import { hasPermission } from "@/lib/permissions/rbac";

function authClients() {
  const actual = {auth: {
    getUser: vi.fn().mockResolvedValue({data: {user: {id: "account-id", email: "person@example.test"}}, error: null}),
    updateUser: vi.fn().mockResolvedValue({data: {user: {id: "account-id"}}, error: null}),
    signOut: vi.fn().mockResolvedValue({error: null}),
  }};
  const verifier = {auth: {
    signInWithPassword: vi.fn().mockResolvedValue({data: {user: {id: "account-id"}}, error: null}),
    signOut: vi.fn().mockResolvedValue({error: null}),
  }};
  return {actual, verifier, client: actual as unknown as SupabaseClient, checker: verifier as unknown as SupabaseClient};
}

describe("Personal AEMS accounts", () => {
  beforeEach(() => resetAemsState());
  it("does not accept a client-supplied role during registration", () => {
    const input = {full_name: "Test User", email: "person@example.test", password: "Example-valid-pass", confirmation: "Example-valid-pass"};
    expect(registrationSchema.safeParse(input).success).toBe(true);
    expect(registrationSchema.safeParse({...input, role: "ADMIN"}).success).toBe(false);
  });
  it("validates password confirmation, strength, and difference from old password", () => {
    expect(passwordChangeSchema.safeParse({current_password: "Old-pass-example", new_password: "Old-pass-example", confirmation: "Old-pass-example"}).success).toBe(false);
    expect(passwordChangeSchema.safeParse({current_password: "Old-pass-example", new_password: "short", confirmation: "short"}).success).toBe(false);
    expect(passwordChangeSchema.safeParse({current_password: "Old-pass-example", new_password: "New-pass-example", confirmation: "Mismatch-example"}).success).toBe(false);
  });
  it("verifies the old password before changing a password", async () => {
    const {client, checker, actual, verifier} = authClients();
    verifier.auth.signInWithPassword.mockResolvedValue({data: {user: null}, error: {code: "invalid_credentials", status: 400}});
    await expect(changeOwnPassword(client, checker, "incorrect-example", "New-pass-example")).rejects.toMatchObject({message: "Kata sandi lama salah."});
    expect(actual.auth.updateUser).not.toHaveBeenCalled();
  });
  it("only updates the identity validated by the signed-in session and closes other sessions", async () => {
    const {client, checker, actual, verifier} = authClients();
    await changeOwnPassword(client, checker, "Old-pass-example", "New-pass-example");
    expect(verifier.auth.signInWithPassword).toHaveBeenCalledWith({email: "person@example.test", password: "Old-pass-example"});
    expect(actual.auth.updateUser).toHaveBeenCalledWith({password: "New-pass-example"});
    expect(actual.auth.signOut).toHaveBeenCalledWith({scope: "others"});
    expect(verifier.auth.signOut).toHaveBeenCalledWith({scope: "local"});
  });
  it("cleans up the verification session if Auth rejects the new password", async () => {
    const {client, checker, actual, verifier} = authClients();
    actual.auth.updateUser.mockResolvedValue({data: {user: null}, error: {message: "policy"}});
    await expect(changeOwnPassword(client, checker, "Old-pass-example", "New-pass-example")).rejects.toThrow();
    expect(verifier.auth.signOut).toHaveBeenCalled();
  });
  it("blocks business data until an admin assigns an account type", () => {
    const state = getAemsState();
    const user = {...state.profiles[0], id: crypto.randomUUID(), email: "pending@example.test", role: null};
    state.profiles.push(user);
    expect(hasPermission(user, "asset:read")).toBe(false);
    const admin = state.profiles.find(p => p.role === "ADMIN")!;
    manageUserProfile(admin, {...user, role: "ACCOUNTING"});
    expect(hasPermission(state.profiles.find(p => p.id === user.id), "asset:write")).toBe(true);
    expect(hasPermission(state.profiles.find(p => p.id === user.id), "equipment:write")).toBe(false);
  });
  it("does not silently assign Accounting when toggling an unassigned account", () => {
    const state = getAemsState();
    const pending = {...state.profiles[0], id: crypto.randomUUID(), email: "pending@example.test", role: null};
    state.profiles.push(pending);
    manageUserProfile(state.profiles.find(p => p.role === "ADMIN")!, {...pending, is_active: false});
    expect(pending.role).toBe(null);
  });
  it("retains the last active administrator", () => {
    const admin = getAemsState().profiles.find(p => p.role === "ADMIN")!;
    expect(() => manageUserProfile(admin, {...admin, role: "ACCOUNTING"})).toThrow("Administrator aktif terakhir");
    expect(() => manageUserProfile(admin, {...admin, is_active: false})).toThrow("Administrator aktif terakhir");
  });
  it("does not create another admin through account-type assignment", () => {
    const state = getAemsState();
    const admin = state.profiles.find(p => p.role === "ADMIN")!;
    const accounting = state.profiles.find(p => p.role === "ACCOUNTING")!;
    expect(() => manageUserProfile(admin, {...accounting, role: "ADMIN"})).toThrow("Accounting atau Equipment");
  });
});
