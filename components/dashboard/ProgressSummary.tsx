"use client";

import type { Task } from "@/lib/types";
import { summarizeProgress } from "@/lib/taskUtils";

export function ProgressSummary({ tasks }: { tasks: Task[] }) {
  const c = summarizeProgress(tasks);

  const rows = [
    { label: "Completed", value: c.completed, dot: "bg-green" },
    { label: "Started", value: c.started, dot: "bg-forest" },
    { label: "Shrunk", value: c.shrunk, dot: "bg-forest/60" },
    { label: "Moved", value: c.moved, dot: "bg-charcoal/35" },
    { label: "Cut", value: c.cut, dot: "bg-charcoal/20" },
    { label: "Still pending", value: c.pending + c.overdue, dot: "bg-peach" },
  ];

  return (
    <section className="card p-6">
      <p className="eyebrow">Progress, honestly counted</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-charcoal/70">
              <span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
              {r.label}
            </span>
            <span className="font-medium text-charcoal">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
