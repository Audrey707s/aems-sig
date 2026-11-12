"use client";
import { useState, type FormEvent } from "react";
import type { Asset, Equipment, ReferenceItem } from "@/lib/types/domain";
import { updateAssetSchema, updateEquipmentSchema } from "@/lib/utils/schemas";

type Field = {key: string; label: string; type?: "text" | "date" | "number" | "textarea"; required?: boolean; admin?: boolean; options?: [string, string][]};
export const conditionOptions: [string, string][] = [["BAIK", "Baik"], ["RUSAK_RINGAN", "Rusak ringan"], ["RUSAK_BERAT", "Rusak berat"], ["DALAM_PERBAIKAN", "Dalam perbaikan"], ["TIDAK_DIKETAHUI", "Tidak diketahui"]];
const commonFields: Field[] = [{key:"name",label:"Nama",required:true},{key:"manufacturer",label:"Pabrikan"},{key:"model",label:"Model"},{key:"serial_no",label:"Nomor seri"}];
const inputClass = "mt-1 block min-h-11 w-full rounded-lg border border-[#E8E2DB] bg-white px-3 py-2 text-sm font-normal text-[#1A3263] disabled:bg-slate-100 disabled:text-slate-500";
export function MasterEditForm({kind, item, references, isAdmin, onCancel, onSaved, onReload}: {
  kind: "asset" | "equipment"; item: Asset | Equipment; references: {categories: ReferenceItem[]; locations: ReferenceItem[]}; isAdmin: boolean;
  onCancel: () => void; onSaved: () => Promise<void>; onReload: () => Promise<void>;
}) {
  const fields: Field[] = kind === "asset" ? [
    {key:"company_code",label:"Company code",required:true,admin:true},{key:"sap_asset_no",label:"Nomor aset SAP",required:true,admin:true},{key:"sap_sub_no",label:"Sub-nomor aset",required:true,admin:true},
    ...commonFields,{key:"description",label:"Deskripsi",type:"textarea"},{key:"asset_category_id",label:"Kategori",options:references.categories.map(c=>[c.id,c.name])},
    {key:"location_id",label:"Lokasi",options:references.locations.map(l=>[l.id,l.name])},{key:"cost_center",label:"Cost center"},
    {key:"acquisition_date",label:"Tanggal perolehan",type:"date"},{key:"acquisition_value",label:"Nilai perolehan",type:"number"},{key:"currency",label:"Mata uang",required:true},
    {key:"status",label:"Status siklus hidup",options:[["ACTIVE","Aktif"],["INACTIVE","Tidak aktif"],["DISPOSED","Dilepas / Disposed"]],required:true},
  ] : [
    {key:"source_system",label:"Source system",required:true,admin:true},{key:"equipment_no",label:"Nomor equipment",required:true,admin:true},...commonFields,
    {key:"kind",label:"Jenis equipment",options:[["WHOLE_UNIT","Perangkat utuh"],["COMPONENT","Komponen"],["OTHER","Lainnya"]],required:true},
    {key:"specification",label:"Spesifikasi",type:"textarea"},{key:"equipment_category_id",label:"Kategori",options:references.categories.map(c=>[c.id,c.name])},
    {key:"location_id",label:"Lokasi",options:references.locations.map(l=>[l.id,l.name])},{key:"condition",label:"Kondisi fisik",options:conditionOptions,required:true},
    {key:"install_date",label:"Tanggal pemasangan",type:"date"},{key:"status",label:"Status siklus hidup",options:[["ACTIVE","Aktif"],["INACTIVE","Tidak aktif"],["RETIRED","Dipensiunkan / Retired"]],required:true},
  ];
  const source = item as unknown as Record<string, unknown>;
  const [values, setValues] = useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.key,String(source[f.key]??"")])));
  const [physicalCondition, setPhysicalCondition] = useState(String(item.attributes.physical_condition || "TIDAK_DIKETAHUI"));
  const [attributes, setAttributes] = useState(JSON.stringify(Object.fromEntries(Object.entries(item.attributes).filter(([key])=>kind!=="asset" || key!=="physical_condition")),null,2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if(busy) return;
    setError(""); setConflict(false);
    let extra: Record<string, unknown>;
    try {extra=JSON.parse(attributes); if(!extra || Array.isArray(extra) || typeof extra!=="object") throw new Error();}
    catch {setError("Atribut tambahan harus berupa objek JSON yang valid.");return;}
    if(kind==="asset" && (physicalCondition!=="TIDAK_DIKETAHUI" || "physical_condition" in item.attributes)) extra.physical_condition=physicalCondition;
    const payload: Record<string,unknown>={row_version:item.row_version,change_reason:reason.trim()};
    for(const field of fields) {
      if(field.admin && !isAdmin) continue;
      const raw=values[field.key];
      const value=field.type==="number" ? raw===""?null:Number(raw) : raw===""&&!field.required ? null : raw.trim();
      if(JSON.stringify(value)!==JSON.stringify(source[field.key])) payload[field.key]=value;
    }
    if(JSON.stringify(extra)!==JSON.stringify(item.attributes)) payload.attributes=extra;
    if(Object.keys(payload).length===2){setError("Belum ada data yang diubah.");return;}
    if(reason.trim().length<3){setError("Alasan perubahan minimal 3 karakter.");return;}
    const parsed=(kind==="asset"?updateAssetSchema:updateEquipmentSchema).safeParse(payload);
    if(!parsed.success){setError(parsed.error.issues[0].message);return;}
    setBusy(true);
    try {
      const response=await fetch(`/api/v1/${kind==="asset"?"assets":"equipment"}/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(parsed.data)});
      const body=await response.json();
      if(!response.ok){setConflict(response.status===409);setError(body.error?.message||"Perubahan gagal disimpan.");return;}
      await onSaved();
    } catch {setError("Koneksi terputus. Periksa data terbaru sebelum mencoba menyimpan kembali.");setConflict(true);}
    finally {setBusy(false);}
  }
  return <form onSubmit={submit} aria-label={kind==="asset"?"Ubah aset":"Ubah equipment"} aria-busy={busy} className="space-y-5 rounded-xl border border-[#E8E2DB] bg-white p-5 shadow-sm">
    <h2 className="text-base font-bold">{kind==="asset"?"Ubah Aset":"Ubah Equipment"}</h2>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}{conflict && <button type="button" disabled={busy} onClick={()=>void onReload()} className="ml-3 font-semibold underline">Muat ulang data</button>}</div>}
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(field=><label key={field.key} className={`block min-w-0 text-sm font-semibold ${field.type==="textarea"?"sm:col-span-2":""}`}>{field.label}{field.required?" *":""}
        {field.options?<select required={field.required} value={values[field.key]} onChange={e=>setValues({...values,[field.key]:e.target.value})} className={inputClass}>{!field.required&&<option value="">Belum ditetapkan</option>}{field.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        :field.type==="textarea"?<textarea rows={3} value={values[field.key]} onChange={e=>setValues({...values,[field.key]:e.target.value})} className={inputClass}/>
        :<input type={field.type||"text"} required={field.required} disabled={field.admin&&!isAdmin} min={field.type==="number"?0:undefined} step={field.type==="number"?"0.01":undefined} maxLength={field.key==="currency"?3:undefined} value={values[field.key]} onChange={e=>setValues({...values,[field.key]:e.target.value})} className={inputClass}/>}
      </label>)}
      {kind==="asset"&&<label className="block text-sm font-semibold">Kondisi fisik<select value={physicalCondition} onChange={e=>setPhysicalCondition(e.target.value)} className={inputClass}>{conditionOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
    </fieldset>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Atribut tambahan (JSON)</summary><textarea disabled={busy} aria-label="Atribut tambahan" rows={5} value={attributes} onChange={e=>setAttributes(e.target.value)} className={`${inputClass} font-mono`}/></details>
    <label className="block text-sm font-semibold">Alasan perubahan *<textarea required minLength={3} maxLength={1000} disabled={busy} rows={2} value={reason} onChange={e=>setReason(e.target.value)} className={inputClass}/></label>
    <div className="flex flex-wrap justify-end gap-2"><button disabled={busy} type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Batal</button><button disabled={busy} className="rounded-lg bg-[#1A3263] px-4 py-2 text-sm font-semibold text-white">{busy?"Menyimpan...":"Simpan Perubahan"}</button></div>
  </form>;
}
