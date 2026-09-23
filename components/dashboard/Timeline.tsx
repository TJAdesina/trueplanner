"use client";

import type { Task } from "@/lib/types";
import { formatTimeRange } from "@/lib/time";
import { effectiveStatus, PRIORITY_DOT, STATUS_LABEL, STATUS_STYLE } from "@/lib/taskUtils";

export function Timeline({ tasks, onSelect }: { tasks: Task[]; onSelect: (task: Task) => void }) {
  if (tasks.length === 0) {
    return (
      <section className="card p-6">
        <p className="eyebrow">Today&rsquo;s schedule</p>
        <p className="mt-3 text-sm text-charcoal/55">
          No tasks yet. Add your first task to see today&rsquo;s timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <p className="eyebrow">Today&rsquo;s schedule</p>
      <ul className="mt-4 space-y-2">
        {tasks.map((task) => {
          const status = effectiveStatus(task);
          const resolved = ["completed", "cut", "moved", "shrunk", "archived"].includes(task.status);
          return (
            <li key={task.id}>
              <button
                onClick={() => onSelect(task)}
                className="flex w-full items-center gap-3 rounded-lg border border-charcoal/8 bg-cream/40 px-3.5 py-2.5 text-left transition-colors hover:bg-cream/80"
              >
                <span className="w-24 shrink-0 text-xs font-medium text-charcoal/50">
                  {formatTimeRange(task.start_time, task.end_time)}
                </span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                <span
                  className={`flex-1 truncate text-sm ${
                    resolved ? "text-charcoal/45" : "font-medium text-charcoal"
                  } ${task.status === "cut" ? "line-through" : ""}`}
                >
                  {task.title}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}
                >
                  {STATUS_LABEL[status]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
