import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {getAemsState,resetAemsState} from "@/lib/db/store";
vi.mock("@/lib/auth/session",()=>({getCurrentProfile:async()=>getAemsState().profiles.find(p=>p.role==="ADMIN")!}));
import {POST} from "@/app/api/v1/admin/users/route";
beforeEach(()=>resetAemsState());
describe("User assignment timestamps",()=>{
 const timestamp="2026-11-17T18:35:38.880926+00:00";
 function fixture(){const user=getAemsState().profiles.find(p=>p.role==="ACCOUNTING")!;user.role=null;user.updated_at=timestamp;return user;}
 it("accepts a fresh Postgres timestamp with offset and microseconds",async()=>{
  const user=fixture();
  const response=await POST(new NextRequest("https://aems.test/api/v1/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...user,role:"ACCOUNTING",account_level:"MANAGER",manager_id:null,expected_updated_at:timestamp})}));
  expect(response.status).toBe(200);expect((await response.json()).data.role).toBe("ACCOUNTING");
 });
 it("still rejects an outdated version",async()=>{
  const user=fixture();
  const response=await POST(new NextRequest("https://aems.test/api/v1/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...user,role:"MAINTENANCE",expected_updated_at:"2026-11-17T18:35:37.880926+00:00"})}));
  expect(response.status).toBe(409);expect(user.role).toBeNull();
 });
});
