"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { formatFriendlyDate } from "@/lib/time";
import { computeDayStatus, DAY_STATUS_LABEL, DAY_STATUS_STYLE, summarizeProgress } from "@/lib/taskUtils";

export function TodayOverview({ tasks }: { tasks: Task[] }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const status = computeDayStatus(tasks, now);
  const counts = summarizeProgress(tasks, now);
  const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "paused").length;
  const needingAttention = counts.overdue;

  return (
    <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-charcoal/50">
          {formatFriendlyDate(now)} &middot;{" "}
          {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl text-forest">Today</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${DAY_STATUS_STYLE[status]}`}>
            {DAY_STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-center sm:gap-6">
        <Stat label="Planned" value={tasks.length} />
        <Stat label="Completed" value={counts.completed} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Needs attention" value={needingAttention} emphasize={needingAttention > 0} />
      </div>
    </section>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div>
      <p className={`font-serif text-2xl ${emphasize ? "text-[#C4732B]" : "text-forest"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-charcoal/45">{label}</p>
    </div>
  );
}
