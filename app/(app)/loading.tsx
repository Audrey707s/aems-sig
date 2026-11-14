export default function Loading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="space-y-5">
      <div className="dashboard-skeleton h-8 w-52 rounded-lg bg-[#e8e2db]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="dashboard-skeleton h-28 rounded-xl border bg-white"
          />
        ))}
      </div>
      <div className="dashboard-skeleton h-64 rounded-xl border bg-white" />
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
