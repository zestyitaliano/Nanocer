import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "./Dashboard";
import type { QrCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: codes } = await supabase
    .from("codes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <Dashboard
      initialCodes={(codes ?? []) as QrCode[]}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
