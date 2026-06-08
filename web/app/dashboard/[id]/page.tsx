import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditorView from "./EditorView";
import type { QrCode, Folder } from "@/lib/types";

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

  const [{ data: code }, { data: folders }] = await Promise.all([
    supabase.from("codes").select("*").eq("id", id).maybeSingle(),
    supabase.from("folders").select("*").order("name", { ascending: true }),
  ]);
  if (!code) notFound(); // RLS also hides other users' codes

  return (
    <EditorView
      code={code as QrCode}
      folders={(folders ?? []) as Folder[]}
      userId={user.id}
    />
  );
}
