"use client";

import { useState } from "react";
import type { NewTask, Task, TaskPriority } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  initial?: Task | null;
  defaultPriority?: TaskPriority;
  onClose: () => void;
  onSave: (values: NewTask, taskId?: string) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

export function TaskFormModal({ initial, defaultPriority = "medium", onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [start, setStart] = useState(toLocalInput(initial?.start_time));
  const [end, setEnd] = useState(
    toLocalInput(initial?.end_time ?? new Date(Date.now() + 45 * 60000).toISOString())
  );
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? defaultPriority);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();
    if (new Date(endIso) <= new Date(startIso)) {
      setError("End time should be after the start time.");
      return;
    }

    setSaving(true);
    await onSave(
      {
        title,
        start_time: startIso,
        end_time: endIso,
        priority,
        description: description || undefined,
        category: category || undefined,
      },
      initial?.id
    );
    setSaving(false);
    onClose();
  }

  return (
    <Modal title={initial ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          id="title"
          label="Task title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write chapter one"
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="start"
            label="Start"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Field
            id="end"
            label="End"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal/80">Priority</label>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  priority === p
                    ? "border-forest bg-forest text-cream"
                    : "border-charcoal/15 text-charcoal/70 hover:bg-charcoal/5"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <Field
          id="category"
          label="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Work, study, personal\u2026"
        />

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-charcoal/80">
            Description (optional)
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-charcoal/15 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal/35 focus:border-forest/40 focus:outline-none focus:ring-2 focus:ring-forest/15"
          />
        </div>

        {error && <p className="text-sm text-[#B3492B]">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {initial && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(initial.id).then(onClose)}
              className="text-sm font-medium text-charcoal/45 hover:text-[#B3492B]"
            >
              Delete task
            </button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving\u2026" : initial ? "Save changes" : "Add task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
