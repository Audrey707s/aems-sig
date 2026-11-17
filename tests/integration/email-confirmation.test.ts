import {beforeEach,describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
const mocks=vi.hoisted(()=>({verifyOtp:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:async()=>({auth:{verifyOtp:mocks.verifyOtp}})}));
import {GET,POST} from "@/app/auth/confirm/route";
const token="a".repeat(64);
function submit(origin="https://aems.test"){return new NextRequest("https://aems.test/auth/confirm",{method:"POST",headers:{origin},body:new URLSearchParams({token_hash:token,type:"signup"})});}
beforeEach(()=>{mocks.verifyOtp.mockReset();mocks.verifyOtp.mockResolvedValue({error:null});});
describe("Confirmation links",()=>{
 it("does not consume a token on a scanner GET",async()=>{const res=await GET(new NextRequest(`https://aems.test/auth/confirm?token_hash=${token}&type=signup`));expect(res.headers.get("location")).toContain("/auth/verify?");expect(mocks.verifyOtp).not.toHaveBeenCalled();});
 it("confirms only on a deliberate same-origin POST",async()=>{const res=await POST(submit());expect(mocks.verifyOtp).toHaveBeenCalledWith({token_hash:token,type:"signup"});expect(res.headers.get("location")).toBe("https://aems.test/pending-approval");});
 it("offers resend for expired links, with no role assignment",async()=>{mocks.verifyOtp.mockResolvedValue({error:{code:"otp_expired"}});const res=await POST(submit());expect(res.headers.get("location")).toBe("https://aems.test/login?confirmation=failed");});
 it("does not verify on a cross-origin POST",async()=>{await POST(submit("https://evil.test"));expect(mocks.verifyOtp).not.toHaveBeenCalled();});
});
