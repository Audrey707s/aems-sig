import {beforeEach,describe,it,expect,vi} from "vitest";
import {aemsRequestState} from "@/lib/db/context";
import type {AemsDatabaseState} from "@/lib/db/seed-data";
let state:AemsDatabaseState;
import {NextRequest} from "next/server";
import {getAemsState,resetAemsState} from "@/lib/db/store";
const mocks=vi.hoisted(()=>({deliver:vi.fn(),commitFails:false}));
vi.mock("@/lib/auth/session",()=>({getCurrentProfile:async()=>getAemsState().profiles.find(p=>p.role==="ADMIN")!}));
vi.mock("@/lib/db/persistence",()=>({withAemsPersistence:(handler:(...args:unknown[])=>Promise<Response>)=>async(...args:unknown[])=>{const res=await aemsRequestState.run({state},()=>handler(...args));return mocks.commitFails?Response.json({error:{message:"Conflict"}},{status:409}):res;}}));
vi.mock("@/lib/email/account-notification",()=>({listAccountNotifications:async()=>[],isAccountEmailConfigured:()=>false,deliverAccountNotification:mocks.deliver}));
import {GET,POST} from "@/app/api/v1/admin/users/route";
beforeEach(()=>{vi.unstubAllEnvs();resetAemsState();state=getAemsState();vi.stubEnv("AEMS_STORAGE_MODE","supabase");mocks.deliver.mockReset();mocks.deliver.mockResolvedValue("FAILED");mocks.commitFails=false;});
describe("Admin verified accounts",()=>{
 it("hides existing unverified profiles as well as new unconfirmed registrations",async()=>{const users=state.profiles;users[0].email_verified_at="2026-11-17T00:00:00Z";const res=await GET();const body=await res.json();expect(body.data.map((p:{id:string})=>p.id)).toEqual([users[0].id]);});
 async function assign(){const user=state.profiles[0];user.role=null;user.email_verified_at="2026-11-17T00:00:00Z";return POST(new NextRequest("https://aems.test/api/v1/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...user,role:"ACCOUNTING",account_level:"MANAGER",manager_id:null,expected_updated_at:user.updated_at})}));}
 it("does not send before a failed persistence commit",async()=>{mocks.commitFails=true;expect((await assign()).status).toBe(409);expect(mocks.deliver).not.toHaveBeenCalled();});
 it("returns a saved usable role even if the notification provider fails",async()=>{const res=await assign();expect(res.status).toBe(200);const body=await res.json();expect(body.data.role).toBe("ACCOUNTING");expect(body.notification_status).toBe("FAILED");expect(mocks.deliver).toHaveBeenCalledOnce();});
});
