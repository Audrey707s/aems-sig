import {isSignupConfirmation} from "@/lib/auth/confirmation";
import Link from "next/link";
import {AuthCard,authButtonClass,authLinkClass} from "@/components/auth/AuthCard";
export const metadata = {referrer: "no-referrer" as const};
export default async function VerifyEmail({searchParams}:{searchParams:Promise<{token_hash?:string;type?:string}>}) {
  const params = await searchParams;
  const valid = isSignupConfirmation(params.token_hash, params.type);
  return <AuthCard title="Konfirmasi email">
    {valid ? <><p className="mb-5 text-sm text-slate-600">Tekan tombol di bawah untuk memverifikasi email. Setelah itu, Super Admin dapat menetapkan jenis akun Anda.</p><form action="/auth/confirm" method="POST"><input type="hidden" name="token_hash" value={params.token_hash}/><input type="hidden" name="type" value={params.type}/><button className={authButtonClass}>Konfirmasi email saya</button></form></> : <p role="alert" className="text-sm text-red-700">Tautan konfirmasi tidak lengkap. Kirim ulang konfirmasi dari halaman daftar.</p>}
    <Link href="/register" className={authLinkClass+" mt-5 block text-center"}>Kembali ke pendaftaran</Link>
  </AuthCard>;
}
