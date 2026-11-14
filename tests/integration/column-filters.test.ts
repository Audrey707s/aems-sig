import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {getAemsState, resetAemsState} from "@/lib/db/store";
import {matchesSelected, sortTableRows} from "@/lib/table-query";
vi.mock("@/lib/auth/session", () => ({getCurrentProfile: async () => getAemsState().profiles.find(p => p.role === "ADMIN")!}));
import {GET as assets} from "@/app/api/v1/assets/route";
import {GET as equipment} from "@/app/api/v1/equipment/route";
async function run(kind: "assets" | "equipment", query: Record<string,string>) {
  return (await (kind === "assets" ? assets : equipment)(new NextRequest(`http://localhost/api/v1/${kind}?${new URLSearchParams(query)}`))).json();
}
beforeEach(() => resetAemsState());
describe("Column filters across all result pages", () => {
  it("combines multiple category selections with location and lifecycle filters before pagination", async () => {
    const s = getAemsState();
    const a = s.assets[0], b = s.assets[1];
    b.location_id = a.location_id; b.status = "INACTIVE";
    const result = await run("assets", {category_id: `${a.asset_category_id},${b.asset_category_id}`,location_id: a.location_id!,status: "ACTIVE,INACTIVE",page_size:"1",page:"2"});
    expect(result.meta.total).toBe(2); expect(result.meta.total_pages).toBe(2); expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(b.id);
  });
  it("sorts financial values numerically over the full result set before paging", async () => {
    const s = getAemsState(); s.assets.forEach((a,i) => {a.acquisition_value = [9,100,20,300][i];});
    const result = await run("assets", {sort_by:"acquisition_value",sort_dir:"desc",page_size:"2"});
    expect(result.data.map((a: {acquisition_value: number}) => a.acquisition_value)).toEqual([300,100]);
  });
  it("supports equipment category, location, status and condition selections together", async () => {
    const s = getAemsState(), a = s.equipment[0];
    const result = await run("equipment", {category_id: a.equipment_category_id || "__none__",location_id: a.location_id || "__none__",status:a.status,condition:a.condition});
    expect(result.data.some((e: {id: string}) => e.id === a.id)).toBe(true);
    for (const row of result.data) {expect(row.condition).toBe(a.condition); expect(row.location_id).toBe(a.location_id); expect(row.status).toBe(a.status); expect(row.equipment_category_id).toBe(a.equipment_category_id);}
  });
  it("supports parent types and asset-root filters, including unmapped equipment", async () => {
    const s = getAemsState(), a = s.assets[0];
    const mapped = await run("equipment", {root_asset_id:a.id,parent_kind:"ASSET,EQUIPMENT"});
    expect(mapped.data.length).toBeGreaterThan(0);
    expect(mapped.data.every((e: {root_asset_id: string}) => e.root_asset_id === a.id)).toBe(true);
    const unmapped = await run("equipment", {root_asset_id:"__none__"});
    expect(unmapped.data.every((e: {root_asset_id: string | null}) => e.root_asset_id === null)).toBe(true);
  });
  it("preserves a meaningful Sub-aset identity when two assets share their main number", async () => {
    const s = getAemsState(), first = s.assets[0];
    s.assets.push({...first,id:crypto.randomUUID(),sap_sub_no:"0001"});
    const result = await run("assets", {q:first.sap_asset_no,sort_by:"sap_sub_no"});
    expect(result.data.map((a: {sap_sub_no: string}) => a.sap_sub_no)).toEqual(["0000","0001"]);
  });
  it("returns no rows for incompatible filters without losing filter options", async () => {
    const result = await run("equipment", {kind:"NONEXISTENT",condition:"BAIK"});
    expect(result.meta.total).toBe(0); expect(result.data).toEqual([]); expect(result.references.locations.length).toBeGreaterThan(0);
  });
  it("keeps nulls last in both directions and falls back for unknown sort keys", () => {
    const rows = [{id:"a",value:null},{id:"b",value:2},{id:"c",value:10}];
    expect(sortTableRows(rows,"value","desc",["value"],"value").map(r=>r.id)).toEqual(["c","b","a"]);
    expect(sortTableRows(rows,"private_field","asc",["value"],"value").map(r=>r.id)).toEqual(["b","c","a"]);
    expect(matchesSelected(null,"__none__")).toBe(true); expect(matchesSelected(false,"false")).toBe(true); expect(matchesSelected("ACTIVE","")).toBe(true);
  });
});
