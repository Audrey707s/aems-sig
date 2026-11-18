import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({signUp:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{signUp:mocks.signUp}})}));
import {POST} from "@/app/api/v1/auth/register/route";
const body={full_name:"Test User",email:"person@example.test",password:"Example-password",confirmation:"Example-password"};
function req(extra:object={}){return new NextRequest("https://aems.test/api/v1/auth/register",{method:"POST",headers:{origin:"https://aems.test","Content-Type":"application/json"},body:JSON.stringify({...body,...extra})});}
beforeEach(()=>{vi.stubEnv("AEMS_STORAGE_MODE","supabase");mocks.signUp.mockReset();});
describe("Email-verified registration",()=>{
 it("requires email confirmation and does not redirect into approval prematurely",async()=>{mocks.signUp.mockResolvedValue({data:{session:null,user:{id:"new-user",confirmation_sent_at:"2026-11-18T00:00:00Z"}},error:null});const r=await POST(req());expect(r.status).toBe(201);const j=await r.json();expect(j.redirect).toBeUndefined();expect(j.requires_confirmation).toBe(true);expect(j.message).toContain("kedaluwarsa");expect(mocks.signUp.mock.calls[0][0].options.data).toEqual({full_name:"Test User"});});
 it("does not claim to send confirmation for an already verified email",async()=>{mocks.signUp.mockResolvedValue({data:{session:null,user:{identities:[]}},error:null});const r=await POST(req());expect(r.status).toBe(400);expect((await r.json()).error.message).toContain("terverifikasi");});
 it("does not claim confirmation was sent when Auth supplies no delivery timestamp",async()=>{mocks.signUp.mockResolvedValue({data:{session:null,user:{id:"new-user"}},error:null});const r=await POST(req());expect(r.status).toBe(503);expect((await r.json()).error.message).toContain("belum dapat dipastikan");});
 it("returns a retry interval when the email provider rejects repeated sends",async()=>{mocks.signUp.mockResolvedValue({data:{},error:{status:429,code:"over_email_send_rate_limit"}});const r=await POST(req());expect(r.status).toBe(429);expect(r.headers.get("Retry-After")).toBe("60");});
 it("rejects self-assigned roles before calling auth",async()=>{const r=await POST(req({role:"ADMIN"}));expect(r.status).toBe(400);expect(mocks.signUp).not.toHaveBeenCalled();});
 it("gives an existing user the correct next step",async()=>{mocks.signUp.mockResolvedValue({data:{},error:{code:"user_already_exists",status:400}});const r=await POST(req());expect(r.status).toBe(400);expect((await r.json()).error.message).toContain("Lupa kata sandi");});
});
