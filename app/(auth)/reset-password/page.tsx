import Link from "next/link";
import { cookies } from "next/headers";
import { AuthCard, authLinkClass } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, verifyRecoveryGrant } from "@/lib/auth/recovery";
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage({searchParams}: {searchParams: Promise<{expired?: string}>}) {
  const query = await searchParams;
  const client = await createSupabaseServerClient();
  const result = client && !query.expired ? await client.auth.getUser() : null;
  const user = result?.data.user;
  const cookieStore = await cookies();
  const allowed = !!user && !result?.error && verifyRecoveryGrant(cookieStore.get(RECOVERY_COOKIE)?.value, user, process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  return <AuthCard title="Atur Ulang Password">
    {allowed ? <ResetPasswordForm /> : <div className="space-y-5 text-center text-sm"><p role="alert" className="leading-relaxed text-slate-500">Tautan pemulihan tidak berlaku atau sudah kedaluwarsa. Silakan minta tautan baru.</p><Link href="/forgot-password" className={authLinkClass}>Minta tautan baru</Link></div>}
  </AuthCard>;
}
