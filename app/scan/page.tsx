import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/library";
import { createClient } from "@/lib/server";
import { READING_STATUSES, type ReadingStatus } from "@/types/book";
import Scanner from "./Scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const { status } = await searchParams;
  const initialStatus: ReadingStatus = (READING_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as ReadingStatus)
    : "to_read";

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Scanner un livre</h1>
      <p className="mt-1 text-sm text-muted">
        Pointe la caméra vers le code-barres au dos du livre (celui qui commence par 978 ou 979).
      </p>
      <Scanner initialStatus={initialStatus} />
    </main>
  );
}
