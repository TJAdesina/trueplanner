"use client";

import type { Checkin, Task } from "@/lib/types";
import { Button } from "@/components/ui/Button";

interface Props {
  checkin: Checkin;
  task: Task | null;
  onCut: () => void;
  onShrink: () => void;
  onMove: () => void;
  onDismiss: () => void;
}

export function RecoveryPanel({ checkin, task, onCut, onShrink, onMove, onDismiss }: Props) {
  return (
    <section className="card animate-slideIn border-peach/40 bg-peach/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-[#B3692B]">Check-in</p>
          <h2 className="mt-1.5 font-serif text-xl text-forest">{checkin.headline}</h2>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 text-xs font-medium text-charcoal/45 hover:text-charcoal/70"
          aria-label="Dismiss check-in"
        >
          Dismiss
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-charcoal/75">{checkin.message}</p>

      {task && (
        <p className="mt-2 text-xs font-medium text-charcoal/45">Regarding: {task.title}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onCut} className="bg-surface">
          Cut it
        </Button>
        <Button onClick={onShrink}>Shrink it</Button>
        <Button variant="secondary" onClick={onMove} className="bg-surface">
          Move it
        </Button>
      </div>
    </section>
  );
}
