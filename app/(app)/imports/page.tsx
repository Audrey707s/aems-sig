import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
export default async function Page() {
  const user = await getCurrentProfile();
  redirect(
    user.role === "MAINTENANCE" ? "/equipment/import" : "/assets/import",
  );
}
