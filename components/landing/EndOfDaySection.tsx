const SUMMARY = [
  { count: 4, label: "completed" },
  { count: 1, label: "meaningfully started" },
  { count: 1, label: "reduced" },
  { count: 2, label: "moved" },
];

export function EndOfDaySection() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="content-wrap grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl font-medium text-forest sm:text-4xl">
            A more honest picture of progress.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-charcoal/70">
            Not every useful day ends with every task completed. See what you
            finished, what you started, what you reduced, and what you
            intentionally moved forward.
          </p>
        </div>

        <div className="card p-7">
          <p className="eyebrow">Today&rsquo;s work, honestly recorded</p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {SUMMARY.map((s) => (
              <div key={s.label} className="rounded-card bg-cream/70 p-4">
                <p className="font-serif text-3xl text-forest">{s.count}</p>
                <p className="mt-1 text-sm text-charcoal/60">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-relaxed text-charcoal/60">
            You completed three tasks, made progress on two others, and moved
            one task to tomorrow.
          </p>
        </div>
      </div>
    </section>
  );
}
