import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRecoveryGrant, verifyRecoveryGrant, RECOVERY_COOKIE } from "@/lib/auth/recovery";
const {auth} = vi.hoisted(() => ({auth: {getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn()}}));
vi.mock("@/lib/supabase/server", () => ({createSupabaseServerClient: vi.fn(async () => ({auth}))}));
import { POST as reset } from "@/app/api/v1/auth/reset-password/route";
import { POST as forgot } from "@/app/api/v1/auth/forgot-password/route";
import { GET as callback } from "@/app/auth/recovery/route";
const user = {id: "test-user-id", updated_at: "2026-11-12T00:00:00Z"};
const secret = "test-only-recovery-signing-secret";
function request(path: string, body: unknown, grant?: string, origin = "https://example.test") {
  return new NextRequest(`https://example.test${path}`, {method: "POST", headers: {origin, "Content-Type": "application/json", ...(grant ? {cookie: `${RECOVERY_COOKIE}=${grant}`} : {})}, body: JSON.stringify(body)});
}
const passwordBody = {password: "Example-new-password", confirmation: "Example-new-password"};

describe("Password recovery proof", () => {
  it("binds a valid proof to an identity and version", () => {
    const token = createRecoveryGrant(user, secret, 1000);
    expect(verifyRecoveryGrant(token, user, secret, 1001)).toBe(true);
    expect(verifyRecoveryGrant(token, {...user, id: "another-user"}, secret, 1001)).toBe(false);
    expect(verifyRecoveryGrant(token, {...user, updated_at: "2026-11-12T00:01:00Z"}, secret, 1001)).toBe(false);
  });
  it("rejects expired, tampered, malformed and wrongly signed proofs", () => {
    const token = createRecoveryGrant(user, secret, 1000);
    expect(verifyRecoveryGrant(token, user, secret, 601001)).toBe(false);
    expect(verifyRecoveryGrant(token, user, "wrong-secret", 1001)).toBe(false);
    expect(verifyRecoveryGrant(token + "x", user, secret, 1001)).toBe(false);
    expect(verifyRecoveryGrant("not-a-proof", user, secret)).toBe(false);
    expect(verifyRecoveryGrant(undefined, user, secret)).toBe(false);
  });
});
describe("Recovery endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", secret); vi.stubEnv("AEMS_STORAGE_MODE", "supabase");
    auth.getUser.mockResolvedValue({data: {user}, error: null});
    auth.updateUser.mockResolvedValue({data: {user}, error: null});
    auth.signOut.mockResolvedValue({error: null});
    auth.resetPasswordForEmail.mockResolvedValue({data: {}, error: null});
  });
  it("does not allow an ordinary logged-in session to reset a password", async () => {
    expect((await reset(request("/api/v1/auth/reset-password", passwordBody))).status).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests and password mismatches", async () => {
    const grant = createRecoveryGrant(user, secret);
    expect((await reset(request("/api/v1/auth/reset-password", passwordBody, grant, "https://other.test"))).status).toBe(403);
    expect((await reset(request("/api/v1/auth/reset-password", {...passwordBody, confirmation: "different"}, grant))).status).toBe(400);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("updates only the verified identity, consumes its cookie, and closes sessions", async () => {
    const response = await reset(request("/api/v1/auth/reset-password", passwordBody, createRecoveryGrant(user, secret)));
    expect(response.status).toBe(200);
    expect(auth.updateUser).toHaveBeenCalledWith({password: passwordBody.password});
    expect(auth.signOut).toHaveBeenCalledWith({scope: "global"});
    expect(response.headers.get("set-cookie")).toContain(`${RECOVERY_COOKIE}=;`);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("sends recovery only to the fixed same-origin callback and hides account existence", async () => {
    const response = await forgot(request("/api/v1/auth/forgot-password", {email: "person@example.test"}));
    expect(response.status).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.test", {redirectTo: "https://example.test/auth/recovery"});
    expect((await response.json()).message).toContain("Jika email terdaftar");
  });
  it("reports unavailable email delivery instead of claiming it was sent", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({error: {status: 500}});
    expect((await forgot(request("/api/v1/auth/forgot-password", {email: "person@example.test"}))).status).toBe(503);
  });
  it("cannot mint a recovery proof from an existing session alone", async () => {
    const response = await callback(new NextRequest("https://example.test/auth/recovery"));
    expect(response.headers.get("location")).toBe("https://example.test/reset-password?expired=1");
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("exchanges a single-use email code and issues an HttpOnly expiring proof", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({data: {user}, error: null});
    const response = await callback(new NextRequest("https://example.test/auth/recovery?code=example-test-code&next=https://other.test"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("example-test-code");
    expect(response.headers.get("location")).toBe("https://example.test/reset-password");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=600");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
