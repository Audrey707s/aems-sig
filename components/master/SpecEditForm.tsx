"use client";
import { useState, type FormEvent } from "react";
import type { EquipmentSpecItem } from "@/lib/types/domain";
export function SpecEditForm({item, equipmentId, onCancel, onSaved}: {item: EquipmentSpecItem; equipmentId: string; onCancel:()=>void; onSaved:()=>Promise<void>}) {
  const expected = {spec_name:item.spec_name,spec_value:item.spec_value,spec_group:item.spec_group,quantity:item.quantity,serial_no:item.serial_no};
  const [values,setValues]=useState(expected);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(event: FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try {
      const response=await fetch(`/api/v1/equipment/${equipmentId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"UPDATE_SPEC",spec_item_id:item.id,values,expected})});
      const body=await response.json();if(!response.ok){setError(body.error?.message||"Perubahan gagal disimpan.");return;}await onSaved();
    }catch{setError("Koneksi terputus. Muat ulang data sebelum mencoba kembali.");}finally{setBusy(false);}
  }
  const cls="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal";
  return <form aria-label="Ubah spesifikasi" onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-3">
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    <fieldset disabled={busy} className="space-y-3">
      <label className="block font-semibold">Nama spesifikasi<input required value={values.spec_name} onChange={e=>setValues({...values,spec_name:e.target.value})} className={cls}/></label>
      <label className="block font-semibold">Nilai spesifikasi<input required value={values.spec_value} onChange={e=>setValues({...values,spec_value:e.target.value})} className={cls}/></label>
      <label className="block font-semibold">Kelompok<input value={values.spec_group||""} onChange={e=>setValues({...values,spec_group:e.target.value||null})} className={cls}/></label>
      <label className="block font-semibold">Jumlah<input required type="number" min={1} step={1} value={values.quantity} onChange={e=>setValues({...values,quantity:Number(e.target.value)})} className={cls}/></label>
      <label className="block font-semibold">Nomor seri komponen<input value={values.serial_no||""} onChange={e=>setValues({...values,serial_no:e.target.value||null})} className={cls}/></label>
    </fieldset>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="rounded border px-3 py-2">Batal</button><button disabled={busy} className="rounded bg-[#1A3263] px-3 py-2 text-white">{busy?"Menyimpan...":"Simpan Spesifikasi"}</button></div>
  </form>;
}
