import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAemsState, resetAemsState } from "@/lib/db/store";
import { formatErrorResponse, AemsError } from "@/lib/utils/errors";

vi.mock("@/lib/auth/session", () => ({
  getCurrentProfile: async () => getAemsState().profiles.find(p => p.role === "ADMIN")!,
}));
import { GET as assets } from "@/app/api/v1/assets/route";
import { GET as equipment } from "@/app/api/v1/equipment/route";
import { POST as reject } from "@/app/api/v1/mapping/requests/[id]/reject/route";

describe("Browser/API contracts", () => {
  beforeEach(() => resetAemsState());
  it("never exposes unexpected server exception text to users", () => {
    const response = formatErrorResponse(new Error("postgres://private-host query SELECT password"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("private-host");
    expect(formatErrorResponse(new AemsError("VALIDATION", "Nama wajib diisi")).body.error.message).toBe("Nama wajib diisi");
  });
  it("category links from dashboard find assets and report accurate direct equipment counts", async () => {
    const state = getAemsState();
    const asset = state.assets.find(a => state.asset_categories.some(c => c.id === a.asset_category_id))!;
    const category = state.asset_categories.find(c => c.id === asset.asset_category_id)!;
    const response = await assets(new NextRequest(`http://localhost/api/v1/assets?q=${encodeURIComponent(category.name)}`));
    const body = await response.json();
    const result = body.data.find((a: {id: string}) => a.id === asset.id);
    expect(result).toBeTruthy();
    expect(result.direct_equipment_count).toBe(state.equipment_active_parent.filter(p => p.parent_kind === "ASSET" && p.parent_id === asset.id).length);
  });
  it("keeps paginated asset results reachable beyond the first 25 rows", async () => {
    const state = getAemsState();
    const original = state.assets[0];
    for (let i = 0; i < 30; i++) state.assets.push({...original, id: crypto.randomUUID(), sap_asset_no: `TEST-${i}`});
    const response = await assets(new NextRequest("http://localhost/api/v1/assets?page=2&page_size=25"));
    const body = await response.json();
    expect(body.meta.total).toBe(state.assets.length);
    expect(body.meta.total_pages).toBe(2);
    expect(body.data.length).toBe(state.assets.length - 25);
  });
  it("supports equipment specification searches as advertised in the search field", async () => {
    const target = getAemsState().equipment[0];
    target.specification = "UniqueSpecRegression";
    const response = await equipment(new NextRequest("http://localhost/api/v1/equipment?q=UniqueSpecRegression"));
    const body = await response.json();
    expect(body.data.map((e: {id: string}) => e.id)).toEqual([target.id]);
  });
  it("rejects a mapping rejection without a real review reason", async () => {
    const response = await reject(new NextRequest("http://localhost/api/v1/mapping/requests/test/reject", {method: "POST", body: JSON.stringify({review_note: " "})}), {params: Promise.resolve({id: "test"})});
    expect(response.status).toBe(400);
  });
});
