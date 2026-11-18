import Link from "next/link";
import {AuthCard,authLinkClass} from "@/components/auth/AuthCard";
import {ConfirmationRetry} from "@/components/auth/ConfirmationRetry";
export const metadata={referrer:"strict-origin" as const};
export default async function ConfirmationError({searchParams}:{searchParams:Promise<{reason?:string}>}) {
  const {reason}=await searchParams;
  const message=reason === "expired" ? "Tautan ini sudah digunakan atau kedaluwarsa. Kirim ulang konfirmasi dan gunakan email yang paling baru." : reason === "unavailable" ? "Layanan konfirmasi belum berhasil menyelesaikan permintaan. Coba buka ulang tautan terbaru beberapa saat lagi." : "Konfirmasi email belum berhasil. Buka tautan terbaru dari email, lalu tekan Konfirmasi email saya. Anda juga dapat meminta email baru di bawah.";
  return <AuthCard title="Email belum berhasil dikonfirmasi"><p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{message}</p><p className="mt-4 text-sm text-slate-600">Halaman ini tidak menyatakan pendaftaran berhasil. Akun lain yang sedang login tetap terpisah dari proses konfirmasi ini.</p><ConfirmationRetry/><Link href="/register" className={authLinkClass+" mt-5 block text-center"}>Kembali ke pendaftaran</Link></AuthCard>;
}
