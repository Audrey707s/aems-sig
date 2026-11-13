import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
export default async function Page() {
  const u = await getCurrentProfile();
  redirect(
    u.role === "ADMIN" ? "/master-data/users" : "/master-data/organizations",
  );
}
