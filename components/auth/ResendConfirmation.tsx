"use client";
import {useEffect,useState} from "react";
import {authLinkClass} from "./AuthCard";
export function ResendConfirmation({email}:{email:string}){
 const [busy,setBusy]=useState(false),[remaining,setRemaining]=useState(0),[feedback,setFeedback]=useState<{ok:boolean;message:string}|null>(null);
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(value=>Math.max(0,value-1)),1000);return ()=>clearTimeout(timer);},[remaining]);
 useEffect(()=>{setFeedback(null);},[email]);
 async function resend(){
  if(busy||remaining)return;
  setBusy(true);setFeedback(null);
  try {const response=await fetch("/api/v1/auth/resend-confirmation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const body=await response.json();setFeedback({ok:response.ok,message:response.ok?body.message:body.error?.message||"Permintaan gagal. Coba kembali."});if(response.ok||response.status===429)setRemaining(60);}
  catch{setFeedback({ok:false,message:"Tidak dapat terhubung. Periksa koneksi dan coba kembali."});}
  finally{setBusy(false);}
 }
 return <div className="mt-4 space-y-2 text-sm"><button type="button" onClick={resend} disabled={busy||remaining>0||!email.trim()} className={authLinkClass+" disabled:opacity-50"}>{busy?"Memproses…":remaining?`Kirim ulang dalam ${remaining} detik`:"Kirim ulang email konfirmasi"}</button>{feedback&&<p role={feedback.ok?"status":"alert"} className={feedback.ok?"text-emerald-800":"text-red-700"}>{feedback.message}</p>}</div>;
}
