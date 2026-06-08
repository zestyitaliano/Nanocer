import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardHome from "./DashboardHome";
import type { QrCode, Folder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: codes }, { data: folders }] = await Promise.all([
    supabase.from("codes").select("*").order("created_at", { ascending: false }),
    supabase.from("folders").select("*").order("name", { ascending: true }),
  ]);

  return (
    <DashboardHome
      initialCodes={(codes ?? []) as QrCode[]}
      initialFolders={(folders ?? []) as Folder[]}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
