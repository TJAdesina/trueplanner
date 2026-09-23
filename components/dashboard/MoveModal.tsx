"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MoveModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task;
  onClose: () => void;
  onConfirm: (newStart: string, newEnd: string) => Promise<void>;
}) {
  const duration = new Date(task.end_time).getTime() - new Date(task.start_time).getTime();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [start, setStart] = useState(toLocalInput(tomorrow));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const newStart = new Date(start);
    const newEnd = new Date(newStart.getTime() + duration);
    await onConfirm(newStart.toISOString(), newEnd.toISOString());
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="Move this task" onClose={onClose}>
      <p className="text-sm leading-relaxed text-charcoal/65">
        &ldquo;{task.title}&rdquo; is still important, just not realistic
        today. Choose when to pick it back up.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field
          id="newStart"
          label="New start time"
          type="datetime-local"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <p className="text-xs text-charcoal/45">
          The same duration is kept, so the plan stays realistic.
        </p>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving\u2026" : "Confirm move"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
