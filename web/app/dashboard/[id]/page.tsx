import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorView, { type ListingOption } from "./EditorView";
import type { QrCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: code }, { data: listings }] = await Promise.all([
    supabase.from("codes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, name, address, slug, page_enabled")
      .order("created_at", { ascending: false }),
  ]);
  if (!code) notFound(); // RLS also hides other users' codes

  return (
    <EditorView
      code={code as QrCode}
      listings={(listings ?? []) as ListingOption[]}
      userId={user.id}
    />
  );
}
