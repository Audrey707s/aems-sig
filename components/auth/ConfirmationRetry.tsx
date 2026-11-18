"use client";
import {useState} from "react";
import {authInputClass} from "./AuthCard";
import {ResendConfirmation} from "./ResendConfirmation";
export function ConfirmationRetry() {
  const [email,setEmail]=useState("");
  return <div className="mt-5"><label className="block text-sm font-medium">Email pendaftaran<input type="email" autoComplete="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} className={authInputClass}/></label><ResendConfirmation email={email}/></div>;
}
