import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({signInWithPassword:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{signInWithPassword:mocks.signInWithPassword}})}));
vi.mock("@/lib/supabase/client",()=>({isSupabaseConfigured:()=>true}));
import {POST} from "@/app/api/v1/auth/session/route";
beforeEach(()=>{vi.stubEnv("AEMS_STORAGE_MODE","supabase");mocks.signInWithPassword.mockReset();});
describe("Login error messages",()=>{
 async function login(code:string){mocks.signInWithPassword.mockResolvedValue({data:{user:null},error:{code}});return POST(new NextRequest("https://aems.test/api/v1/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"test@example.test",password:"test-only-password"})}));}
 it("explains that email confirmation is required",async()=>{const r=await login("email_not_confirmed");expect(r.status).toBe(403);expect((await r.json()).error.message).toContain("Email belum dikonfirmasi");});
 it("keeps incorrect credentials generic",async()=>{const r=await login("invalid_credentials");expect(r.status).toBe(401);expect((await r.json()).error.message).toBe("Email atau kata sandi tidak valid.");});
});
