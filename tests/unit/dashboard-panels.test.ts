import {beforeEach, describe, expect, it} from "vitest";
import {buildDashboard, readDashboardFilters} from "@/lib/dashboard";
import {pageWindow} from "@/lib/pagination";
import {getAemsState, resetAemsState} from "@/lib/db/store";
beforeEach(() => resetAemsState());
describe("Dashboard panel pagination", () => {
  it("keeps panels at five items and makes every remaining item reachable exactly once", () => {
    const items = Array.from({length:13}, (_,i) => i);
    const pages = [1,2,3].map(page => {const p=pageWindow(items.length,page); return items.slice(p.offset,p.offset+p.page_size);});
    expect(pages.map(page=>page.length)).toEqual([5,5,3]);
    expect(pages.flat()).toEqual(items);
    expect(pageWindow(13,3)).toMatchObject({first:11,last:13,total_pages:3});
  });
  it("clamps empty, invalid and reduced result sets without blank extra slides", () => {
    expect(pageWindow(0,9)).toMatchObject({page:1,first:0,last:0,total_pages:1});
    expect(pageWindow(5,2)).toMatchObject({page:1,first:1,last:5});
    expect(pageWindow(6,-2).page).toBe(1);
    expect(pageWindow(6,Infinity).page).toBe(1);
  });
  it("paginates all admin activity newest-first instead of discarding older entries", () => {
    const state = getAemsState(), actor = state.profiles.find(p=>p.role==="ADMIN")!, original=state.audit_logs[0];
    state.audit_logs = Array.from({length:12}, (_,i)=>({...original,id:i+1000,actor_id:actor.id,occurred_at:new Date(Date.UTC(2026,10,15,0,i)).toISOString()}));
    const run=(page:number)=>buildDashboard(state,actor,readDashboardFilters(new URLSearchParams(`activity_page=${page}&page=2`)));
    expect(run(1).activities.map(a=>a.id)).toEqual([1011,1010,1009,1008,1007]);
    expect(run(2).activities).toHaveLength(5); expect(run(3).activities).toHaveLength(2);
    expect(new Set([1,2,3].flatMap(page=>run(page).activities.map(a=>a.id))).size).toBe(12);
    expect(run(99).activity_pagination).toMatchObject({page:3,total:12});
    expect(run(2).pagination.page).toBe(2);
  });
  it("calculates activity page totals after restricting the current user's visibility", () => {
    const state=getAemsState(), actor=state.profiles.find(p=>p.role==="ACCOUNTING")!, admin=state.profiles.find(p=>p.role==="ADMIN")!, original=state.audit_logs[0];
    state.audit_logs=Array.from({length:18},(_,i)=>({...original,id:i+1000,actor_id:i<7?actor.id:admin.id,occurred_at:new Date(Date.UTC(2026,10,15,0,i)).toISOString()}));
    const data=buildDashboard(state,actor,readDashboardFilters(new URLSearchParams("activity_page=2")));
    expect(data.activity_pagination).toMatchObject({page:2,total:7,total_pages:2});
    expect(data.activities.map(a=>a.id)).toEqual([1001,1000]);
    expect(readDashboardFilters(new URLSearchParams("activity_page=invalid")).activity_page).toBe(1);
  });
});
