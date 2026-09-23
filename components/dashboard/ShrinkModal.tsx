"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function ShrinkModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task;
  onClose: () => void;
  onConfirm: (newTitle: string, originalScope: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onConfirm(newTitle, task.title);
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="Shrink this task" onClose={onClose}>
      <p className="text-sm leading-relaxed text-charcoal/65">
        &ldquo;{task.title}&rdquo; is too large for the time available. What&rsquo;s a
        meaningful smaller version you can actually finish?
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field
          id="newTitle"
          label="Smaller, meaningful outcome"
          required
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={`e.g. "Write the introduction"`}
        />
        <p className="text-xs text-charcoal/45">
          The original scope is kept in this task&rsquo;s history, so nothing
          is quietly lost.
        </p>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving\u2026" : "Confirm shrink"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
