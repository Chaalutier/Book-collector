import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getPublisherWorks } from "@/lib/library";
import { getPublisherInfo } from "@/lib/publishers";
import { createClient } from "@/lib/server";
import EditForm from "./EditForm";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function EditPublisherPage({ params }: { params: Promise<{ name: string }> }) {
  const name = safeDecode((await params).name).trim();
  if (!name) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const { works } = await getPublisherWorks(supabase, user.id, name);
  const displayName = works[0]?.book.publisher ?? name;
  const info = await getPublisherInfo(supabase, displayName);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href={`/publishers/${encodeURIComponent(displayName)}`} className="text-sm text-muted hover:text-foreground">
        ← {displayName}
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Modifier la maison d&apos;édition</h1>
      <EditForm name={displayName} info={info} bookCount={works.length} />
    </main>
  );
}
