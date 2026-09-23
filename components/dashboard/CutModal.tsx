"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function CutModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    await onConfirm();
    setSaving(false);
    onClose();
  }

  return (
    <Modal title="Cut this task" onClose={onClose}>
      <p className="text-sm leading-relaxed text-charcoal/65">
        &ldquo;{task.title}&rdquo; is no longer essential today. It will be
        removed from today&rsquo;s plan &mdash; not deleted, just set aside.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
        <Button onClick={handleConfirm} disabled={saving}>
          {saving ? "Cutting\u2026" : "Cut from today"}
        </Button>
      </div>
    </Modal>
  );
}
