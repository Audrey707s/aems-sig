import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialSeedState } from "@/lib/db/seed-data";
import { resetAemsState } from "@/lib/db/store";

const mocks = vi.hoisted(() => ({
  headers: new Headers(),
  cookie: undefined as string | undefined,
  configured: true,
  getUser: vi.fn(),
  single: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => mocks.headers,
  cookies: async () => ({get: () => mocks.cookie ? {value: mocks.cookie} : undefined}),
}));
vi.mock("@/lib/supabase/client", () => ({isSupabaseConfigured: () => mocks.configured}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {getUser: mocks.getUser},
    from: () => ({select: () => ({eq: () => ({single: mocks.single})})}),
  }),
}));
import { getCurrentProfile } from "@/lib/auth/session";

describe("Authenticated session boundaries", () => {
  beforeEach(() => {
    resetAemsState();
    mocks.headers = new Headers(); mocks.cookie = undefined; mocks.configured = true;
    mocks.getUser.mockReset(); mocks.single.mockReset();
    vi.stubEnv("AEMS_STORAGE_MODE", "supabase");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("does not fall back to a seed administrator when Supabase configuration is missing", async () => {
    mocks.configured = false;
    await expect(getCurrentProfile()).rejects.toMatchObject({httpStatus: 401});
  });
  it("does not fall back to a local cookie when auth verification fails", async () => {
    mocks.cookie = createInitialSeedState().profiles[2].id;
    mocks.getUser.mockRejectedValue(new Error("network failed"));
    await expect(getCurrentProfile()).rejects.toMatchObject({httpStatus: 401});
  });
  it("does not authorize an account absent from the managed profiles table", async () => {
    mocks.getUser.mockResolvedValue({data: {user: {id: "user", app_metadata: {role: "ADMIN"}}}, error: null});
    mocks.single.mockResolvedValue({data: null});
    await expect(getCurrentProfile()).rejects.toMatchObject({httpStatus: 403});
  });
  it("does not use test identity headers to bypass Supabase JWT verification", async () => {
    mocks.headers.set("x-aems-user-id", createInitialSeedState().profiles[2].id);
    mocks.getUser.mockResolvedValue({data: {user: null}, error: new Error("invalid token")});
    await expect(getCurrentProfile()).rejects.toMatchObject({httpStatus: 401});
  });
  it("returns a validated active profile with an allowed role", async () => {
    const profile = createInitialSeedState().profiles[0];
    mocks.getUser.mockResolvedValue({data: {user: {id: profile.id}}, error: null});
    mocks.single.mockResolvedValue({data: profile});
    await expect(getCurrentProfile()).resolves.toMatchObject({id: profile.id, role: profile.role});
  });
  it("keeps a locally logged-out user logged out", async () => {
    vi.stubEnv("AEMS_STORAGE_MODE", "local-store");
    mocks.cookie = "UNAUTHENTICATED";
    await expect(getCurrentProfile()).rejects.toMatchObject({httpStatus: 401});
  });
});
