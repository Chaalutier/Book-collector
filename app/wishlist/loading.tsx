export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6" aria-busy>
      <div className="h-8 w-40 animate-pulse rounded bg-line" />
      <div className="mt-4 h-11 animate-pulse rounded-lg bg-line" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mt-4 flex gap-3">
          <div className="h-[54px] w-9 animate-pulse rounded bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-line" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </main>
  );
}
