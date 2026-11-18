import {beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({getUser:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createServerClient:()=>({auth:{getUser:mocks.getUser}})}));
vi.mock("@/lib/supabase/client",()=>({isSupabaseConfigured:()=>true}));
import {updateSessionAndProtectRoutes} from "@/lib/supabase/middleware";
beforeEach(()=>{vi.stubEnv("AEMS_STORAGE_MODE","supabase");mocks.getUser.mockReset();mocks.getUser.mockResolvedValue({data:{user:{id:"current-admin"}}});});
describe("Confirmation results never impersonate the current session",()=>{
 it.each(["/login?confirmation=failed","/dashboard?confirmation=failed"])("takes legacy %s to a dedicated result without inspecting or changing the current admin session",async path=>{const res=await updateSessionAndProtectRoutes(new NextRequest("https://aems.test"+path));expect(res.headers.get("location")).toBe("https://aems.test/auth/confirmation-error?reason=invalid");expect(mocks.getUser).not.toHaveBeenCalled();});
 it("keeps the error page visible even when another account is logged in",async()=>{const res=await updateSessionAndProtectRoutes(new NextRequest("https://aems.test/auth/confirmation-error?reason=expired"));expect(res.headers.get("location")).toBeNull();});
 it("keeps the error page visible when logged out",async()=>{mocks.getUser.mockResolvedValue({data:{user:null}});const res=await updateSessionAndProtectRoutes(new NextRequest("https://aems.test/auth/confirmation-error?reason=expired"));expect(res.headers.get("location")).toBeNull();});
 it.each(["/auth/confirm", "/auth/verify", "/auth/callback"])("leaves %s email-proof processing independent of the old session",async path=>{const res=await updateSessionAndProtectRoutes(new NextRequest("https://aems.test"+path));expect(res.headers.get("location")).toBeNull();expect(mocks.getUser).not.toHaveBeenCalled();});
 it("preserves ordinary login routing without carrying a false failure",async()=>{const res=await updateSessionAndProtectRoutes(new NextRequest("https://aems.test/login"));expect(res.headers.get("location")).toBe("https://aems.test/dashboard");});
});
