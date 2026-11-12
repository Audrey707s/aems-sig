"use client";
import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";

export function PasswordChangeForm() {
  const [form, setForm] = useState({current_password: "", new_password: "", confirmation: ""});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ok: boolean; message: string} | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFeedback(null);
    if (form.new_password !== form.confirmation) { setFeedback({ok: false, message: "Konfirmasi kata sandi tidak sama."}); return; }
    if (form.current_password === form.new_password) { setFeedback({ok: false, message: "Kata sandi baru harus berbeda dari kata sandi lama."}); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/password", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(form)});
      const body = await response.json();
      setFeedback({ok: response.ok, message: response.ok ? body.message : body.error?.message || "Kata sandi gagal diubah."});
      if (response.ok) setForm({current_password: "", new_password: "", confirmation: ""});
    } catch { setFeedback({ok: false, message: "Koneksi terputus. Periksa koneksi dan coba kembali."}); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-[#E8E2DB] bg-white p-6 space-y-4">
    <h2 className="flex items-center gap-2 font-bold"><LockKeyhole className="h-4 w-4" />Ganti Password</h2>
    {feedback && <p role="status" className={`rounded-lg border p-3 text-sm ${feedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</p>}
    <form onSubmit={submit} className="space-y-4">
      {([{key: "current_password", label: "Kata sandi lama", auto: "current-password"}, {key: "new_password", label: "Kata sandi baru", auto: "new-password"}, {key: "confirmation", label: "Konfirmasi kata sandi baru", auto: "new-password"}] as const).map(field => <label key={field.key} className="block text-sm font-semibold">{field.label}
        <input type="password" required autoComplete={field.auto} minLength={field.key === "current_password" ? 1 : 8} maxLength={128} value={form[field.key]} onChange={e => setForm({...form, [field.key]: e.target.value})} className="mt-1 w-full rounded-lg border border-[#E8E2DB] px-3 py-2.5 font-normal" />
      </label>)}
      <button disabled={busy} className="rounded-lg bg-[#1A3263] px-4 py-2.5 text-sm font-bold text-white">{busy ? "Menyimpan..." : "Simpan Password"}</button>
    </form>
  </section>;
}
