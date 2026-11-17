import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({resend:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{resend:mocks.resend}})}));
import {POST} from "@/app/api/v1/auth/resend-confirmation/route";
function request(body:unknown,origin="https://aems.test"){return new NextRequest("https://aems.test/api/v1/auth/resend-confirmation",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});}
beforeEach(()=>{vi.stubEnv("AEMS_STORAGE_MODE","supabase");mocks.resend.mockReset();mocks.resend.mockResolvedValue({error:null});});
describe("Resend signup confirmation",()=>{
 it("uses only the fixed same-origin callback and never promises inbox delivery",async()=>{const r=await POST(request({email:" person@example.test "}));expect(r.status).toBe(200);expect(mocks.resend).toHaveBeenCalledWith({type:"signup",email:"person@example.test",options:{emailRedirectTo:"https://aems.test/auth/callback"}});expect((await r.json()).message).toContain("Jika alamat ini");expect(r.headers.get("Cache-Control")).toBe("no-store");});
 it("rejects cross-origin and arbitrary redirects",async()=>{expect((await POST(request({email:"person@example.test"},"https://evil.test"))).status).toBe(403);expect((await POST(request({email:"person@example.test",redirectTo:"https://evil.test"}))).status).toBe(400);expect(mocks.resend).not.toHaveBeenCalled();});
 it("shows throttling without claiming an email was sent",async()=>{mocks.resend.mockResolvedValue({error:{status:429}});const r=await POST(request({email:"person@example.test"}));expect(r.status).toBe(429);expect((await r.json()).error.message).toContain("Tunggu");});
 it("reports provider failure without leaking details",async()=>{mocks.resend.mockResolvedValue({error:{status:500,message:"smtp-secret-details"}});const r=await POST(request({email:"person@example.test"}));expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("smtp-secret-details");});
});
