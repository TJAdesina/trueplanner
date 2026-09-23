"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { formatDuration, formatTimeRange } from "@/lib/time";
import { effectiveStatus, PRIORITY_DOT, PRIORITY_LABEL, STATUS_LABEL, STATUS_STYLE } from "@/lib/taskUtils";
import { Button } from "@/components/ui/Button";

interface Props {
  task: Task | null;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onShrink: (task: Task) => void;
  onMove: (task: Task) => void;
  onCut: (task: Task) => void;
}

export function CurrentTask({ task, onStart, onPause, onComplete, onEdit, onShrink, onMove, onCut }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!task) {
    return (
      <section className="card p-6">
        <p className="eyebrow">Current task</p>
        <p className="mt-3 text-charcoal/60">
          Nothing needs your attention right now. Add a task, or enjoy the quiet.
        </p>
      </section>
    );
  }

  const status = effectiveStatus(task, now);
  const remaining = Math.round((new Date(task.end_time).getTime() - now.getTime()) / 60000);

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Current task</p>
          <h2 className="mt-2 font-serif text-2xl text-forest">{task.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-charcoal/60">
            <span>{formatTimeRange(task.start_time, task.end_time)}</span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
              {PRIORITY_LABEL[task.priority]} priority
            </span>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {task.description && (
        <p className="mt-4 text-sm leading-relaxed text-charcoal/65">{task.description}</p>
      )}

      <p className="mt-4 text-sm font-medium text-charcoal/70">
        {remaining >= 0 ? `${formatDuration(remaining)} remaining` : `${formatDuration(remaining)} over`}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {task.status === "not_started" && (
          <Button onClick={() => onStart(task.id)}>Start</Button>
        )}
        {task.status === "in_progress" && (
          <>
            <Button variant="secondary" onClick={() => onPause(task.id)}>Pause</Button>
            <Button onClick={() => onComplete(task.id)}>Complete</Button>
          </>
        )}
        {task.status === "paused" && (
          <>
            <Button onClick={() => onStart(task.id)}>Resume</Button>
            <Button variant="secondary" onClick={() => onComplete(task.id)}>Complete</Button>
          </>
        )}
        {status === "overdue" && task.status !== "in_progress" && (
          <Button onClick={() => onComplete(task.id)}>Mark complete</Button>
        )}

        <Button variant="ghost" onClick={() => onEdit(task)}>Edit</Button>
        <Button variant="ghost" onClick={() => onShrink(task)}>Shrink</Button>
        <Button variant="ghost" onClick={() => onMove(task)}>Move</Button>
        <Button variant="ghost" onClick={() => onCut(task)}>Cut</Button>
      </div>
    </section>
  );
}
