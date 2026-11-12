import { PendingAccountActions } from "@/components/ui/PendingAccountActions";
import { redirect } from "next/navigation";
import { getSignedInProfile } from "@/lib/auth/personal-account";
import { PasswordChangeForm } from "@/components/ui/PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const profile = await getSignedInProfile();
  if (!profile) redirect("/login");
  if (profile.is_active && profile.role) redirect("/dashboard");
  return <main className="min-h-screen bg-[#F6F4F0] p-4 sm:p-8"><div className="mx-auto max-w-xl space-y-5">
    <section className="rounded-xl border border-[#E8E2DB] bg-white p-6 space-y-3">
      <h1 className="text-xl font-bold">{profile.is_active ? "Menunggu Penetapan Jenis Akun" : "Akun Dinonaktifkan"}</h1>
      <p className="font-semibold">{profile.full_name}</p>
      <p className="text-sm text-[#547792]">{profile.is_active ? "Admin akan menetapkan akun Anda sebagai Accounting atau Equipment. Akses aplikasi tersedia setelah penetapan selesai." : "Hubungi admin untuk memeriksa status akun Anda."}</p>
      <PendingAccountActions />
    </section>
    <PasswordChangeForm />
  </div></main>;
}
