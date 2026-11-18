import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export type NotificationStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";
interface Notice {
  id: string; profile_id: string; recipient: string; full_name: string;
  role: string; account_level: string; manager_name: string | null; lease_id: string;
}
export function isAccountEmailConfigured() {
  return !!process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "").length === 16;
}
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Notification storage unavailable");
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}
export function accountNoticeText(notice: Pick<Notice,"full_name"|"role"|"account_level"|"manager_name">) {
  const role = notice.role === "ADMIN" ? "Administrator" : `${notice.account_level === "MANAGER" ? "Manajer" : "Staff"} ${notice.role === "ACCOUNTING" ? "Accounting" : "Maintenance"}`;
  return `Halo ${notice.full_name},\n\nSuper Admin telah mengaktifkan akses AEMS Anda sebagai ${role}.${notice.manager_name ? `\nAtasan: ${notice.manager_name}.` : ""}\n\nSilakan masuk menggunakan email dan kata sandi yang Anda daftarkan:\nhttps://aems-sig.vercel.app/login\n\nTidak perlu mendaftar atau memverifikasi email lagi. Jika lupa kata sandi, pilih Lupa kata sandi di halaman masuk.\n\nAEMS-SIG`;
}
export function safeMailFailure(error: unknown) {
  const info = error && typeof error === "object" ? error as {code?:unknown;responseCode?:unknown} : {};
  const allowed = ["EAUTH","ECONNECTION","ETIMEDOUT","ESOCKET","EDNS","EENVELOPE","EMESSAGE"];
  return {code: typeof info.code === "string" && allowed.includes(info.code) ? info.code : "MAIL_PROVIDER_ERROR", smtp_status: typeof info.responseCode === "number" && Number.isInteger(info.responseCode) && info.responseCode >= 100 && info.responseCode <= 599 ? info.responseCode : null};
}
export async function sendAccountNotice(notice: Notice) {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass || pass.length !== 16) throw new Error("Email transport unavailable");
  const transport = nodemailer.createTransport({host: "smtp.gmail.com", port: 465, secure: true, auth: {user, pass}, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000});
  try {
    const sent = await transport.sendMail({from: {name: "AEMS-SIG", address: user}, to: [{address: notice.recipient}], subject: "Akses akun AEMS Anda telah ditetapkan", text: accountNoticeText(notice), messageId: `<aems-account-${notice.id}@aems-sig.vercel.app>`});
    if (!sent.accepted.some(address => address.toLowerCase() === notice.recipient.toLowerCase())) throw new Error("Email not accepted");
  } finally { transport.close(); }
}
/** Invoked only after the assignment transaction has committed. Never rolls back saved roles on SMTP errors. */
export async function deliverAccountNotification(profileId: string): Promise<NotificationStatus | "UNAVAILABLE" | null> {
  if (process.env.AEMS_STORAGE_MODE !== "supabase") return null;
  try {
    const client = adminClient();
    const {data, error} = await client.rpc("aems_claim_account_notification", {p_profile_id: profileId});
    if (error) return "UNAVAILABLE";
    const notice = data?.[0] as Notice | undefined;
    if (!notice) {
      const current = await client.from("account_notification_outbox").select("status").eq("profile_id",profileId).order("created_at",{ascending:false}).limit(1).maybeSingle();
      return current.error ? "UNAVAILABLE" : current.data?.status ?? null;
    }
    let status: NotificationStatus = "SENT";
    try { await sendAccountNotice(notice); } catch (error) { status = "FAILED"; console.error("AEMS_ACCOUNT_EMAIL_FAILED", {notification_id: notice.id, ...safeMailFailure(error)}); }
    const result = await client.from("account_notification_outbox").update({status, sent_at: status === "SENT" ? new Date().toISOString() : null}).eq("id",notice.id).eq("lease_id",notice.lease_id).eq("status","SENDING");
    return result.error ? "UNAVAILABLE" : status;
  } catch { return "UNAVAILABLE"; }
}
export async function listAccountNotifications() {
  if (process.env.AEMS_STORAGE_MODE !== "supabase") return [];
  const {data,error} = await adminClient().from("account_notification_outbox").select("profile_id,status,sent_at,created_at").order("created_at",{ascending:false});
  if (error) throw new Error("Notification status unavailable");
  return data ?? [];
}
