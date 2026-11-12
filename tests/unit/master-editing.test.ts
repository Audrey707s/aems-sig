import { beforeEach, describe, expect, it } from "vitest";
import { createAsset, createEquipment, getAemsState, resetAemsState, updateAsset, updateEquipment, addEquipmentSpecItem, updateEquipmentSpecItem } from "@/lib/db/store";
import { updateAssetSchema, updateEquipmentSchema } from "@/lib/utils/schemas";

describe("Master data editing",()=>{
  beforeEach(()=>resetAemsState());
  const people=()=>{const s=getAemsState();return {s,admin:s.profiles.find(p=>p.role==="ADMIN")!,accounting:s.profiles.find(p=>p.role==="ACCOUNTING")!,equipment:s.profiles.find(p=>p.role==="MAINTENANCE")!};};
  it("updates equipment condition, status and metadata with an old/new audit",()=>{
    const {s,equipment}=people();const eq=createEquipment(equipment,{equipment_no:"TEST-EDIT",name:"Uji equipment",kind:"WHOLE_UNIT"});
    updateEquipment(equipment,eq.id,{condition:"RUSAK_RINGAN",status:"INACTIVE",manufacturer:"Maker",model:"New model",install_date:"2026-11-12",specification:"Updated specification",row_version:eq.row_version,change_reason:"Pemeriksaan fisik"});
    expect(eq).toMatchObject({condition:"RUSAK_RINGAN",status:"INACTIVE",manufacturer:"Maker",model:"New model"});
    expect(s.audit_logs[0]).toMatchObject({action:"UPDATE",old_values:{condition:"BAIK"},new_values:{condition:"RUSAK_RINGAN",change_reason:"Pemeriksaan fisik"}});
  });
  it("saves asset physical condition in existing attributes without losing other data",()=>{
    const {accounting}=people();const asset=createAsset(accounting,{sap_asset_no:"EDIT-ASSET",name:"Uji aset",attributes:{warranty:"2027"}});
    updateAsset(accounting,asset.id,{attributes:{...asset.attributes,physical_condition:"DALAM_PERBAIKAN"},acquisition_value:4200,currency:"USD",row_version:asset.row_version});
    expect(asset.attributes).toEqual({warranty:"2027",physical_condition:"DALAM_PERBAIKAN"});expect(asset.acquisition_value).toBe(4200);
  });
  it("blocks cross-role writes",()=>{
    const {s,accounting,equipment}=people();expect(()=>updateEquipment(accounting,s.equipment[0].id,{condition:"RUSAK_BERAT",row_version:1})).toThrow();
    expect(()=>updateAsset(equipment,s.assets[0].id,{name:"Tidak boleh",row_version:1})).toThrow();
  });
  it("restricts every part of the asset/equipment business key to admin",()=>{
    const {s,accounting,equipment}=people();expect(()=>updateAsset(accounting,s.assets[0].id,{company_code:"OTHER",row_version:1})).toThrow("Administrator");
    expect(()=>updateAsset(accounting,s.assets[0].id,{sap_sub_no:"0001",row_version:1})).toThrow("Administrator");
    expect(()=>updateEquipment(equipment,s.equipment[0].id,{source_system:"OTHER",row_version:1})).toThrow("Administrator");
  });
  it("records identity changes in audit and checks the whole composite key",()=>{
    const {s,admin}=people();const first=s.assets[0];const other=createAsset(admin,{sap_asset_no:first.sap_asset_no,company_code:"OTHER",sap_sub_no:first.sap_sub_no,name:"Uji duplikat"});
    expect(()=>updateAsset(admin,other.id,{company_code:first.company_code,row_version:other.row_version,change_reason:"Koreksi perusahaan"})).toThrow("sudah digunakan");
    updateAsset(admin,other.id,{sap_sub_no:"1000",row_version:other.row_version,change_reason:"Koreksi sub nomor"});
    expect(s.audit_logs[0].changed_fields).toContain("sap_sub_no");
  });
  it("does not mutate identity when a later lifecycle validation fails",()=>{
    const {s,admin}=people();const asset=s.assets[0],before=structuredClone(asset);
    expect(()=>updateAsset(admin,asset.id,{sap_asset_no:"WILL-NOT-SAVE",status:"INACTIVE",row_version:asset.row_version,change_reason:"Uji validasi"})).toThrow();
    expect(asset).toEqual(before);
  });
  it("rejects stale equipment edits and invalid reference IDs",()=>{
    const {s,equipment}=people();const eq=s.equipment[0];updateEquipment(equipment,eq.id,{condition:"RUSAK_RINGAN",row_version:eq.row_version});
    expect(()=>updateEquipment(equipment,eq.id,{condition:"RUSAK_BERAT",row_version:1})).toThrow("pengguna lain");
    expect(()=>updateEquipment(equipment,eq.id,{location_id:crypto.randomUUID(),row_version:eq.row_version})).toThrow("Lokasi");
  });
  it("validates dates and disallows hierarchy/system field injection",()=>{
    expect(updateAssetSchema.safeParse({row_version:1,acquisition_date:"2026-02-30"}).success).toBe(false);
    expect(updateEquipmentSchema.safeParse({row_version:1,install_date:"yesterday"}).success).toBe(false);
    expect(updateEquipmentSchema.safeParse({row_version:1,root_asset_id:crypto.randomUUID()}).success).toBe(false);
    expect(updateAssetSchema.safeParse({row_version:1,attributes:{physical_condition:"INVALID"}}).success).toBe(false);
    expect(updateAssetSchema.safeParse({row_version:1,acquisition_date:null}).success).toBe(true);
  });
  it("edits specification values with owner and concurrency checks",()=>{
    const {s,equipment}=people();const owner=s.equipment[0];const item=addEquipmentSpecItem(equipment,{equipment_id:owner.id,spec_name:"RAM",spec_value:"8 GB"});
    const expected={spec_name:item.spec_name,spec_value:item.spec_value,spec_group:item.spec_group,quantity:item.quantity,serial_no:item.serial_no};
    expect(()=>updateEquipmentSpecItem(equipment,s.equipment[1].id,item.id,{...expected,spec_value:"16 GB"},expected)).toThrow("tidak ditemukan");
    updateEquipmentSpecItem(equipment,owner.id,item.id,{...expected,spec_value:"16 GB",quantity:2},expected);
    expect(item.spec_value).toBe("16 GB");expect(s.audit_logs[0].action).toBe("UPDATE_SPEC");
    expect(()=>updateEquipmentSpecItem(equipment,owner.id,item.id,{...expected,spec_value:"32 GB"},expected)).toThrow("pengguna lain");
  });
});
