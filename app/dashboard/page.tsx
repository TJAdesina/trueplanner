"use client";

import { useState } from "react";
import { Plus, Bell } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useProfile } from "@/hooks/useProfile";
import { useCheckinEngine } from "@/hooks/useCheckinEngine";
import type { NewTask, Task } from "@/lib/types";
import { findCurrentTask } from "@/lib/taskUtils";
import { enablePushNotifications } from "@/lib/notifications";

import { TodayOverview } from "@/components/dashboard/TodayOverview";
import { CurrentTask } from "@/components/dashboard/CurrentTask";
import { Timeline } from "@/components/dashboard/Timeline";
import { ProgressSummary } from "@/components/dashboard/ProgressSummary";
import { RecoveryPanel } from "@/components/dashboard/RecoveryPanel";
import { TaskFormModal } from "@/components/dashboard/TaskFormModal";
import { ShrinkModal } from "@/components/dashboard/ShrinkModal";
import { MoveModal } from "@/components/dashboard/MoveModal";
import { CutModal } from "@/components/dashboard/CutModal";
import { Button } from "@/components/ui/Button";

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; task: Task }
  | { type: "shrink"; task: Task }
  | { type: "move"; task: Task }
  | { type: "cut"; task: Task };

export default function DashboardPage() {
  const { tasks, createTask, updateTask, deleteTask, startTask, pauseTask, completeTask, cutTask, shrinkTask, moveTask } =
    useTasks();
  const { profile, updateProfile } = useProfile();
  const { activeCheckin, dismiss, resolve } = useCheckinEngine(tasks, profile);

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [pushError, setPushError] = useState<string | null>(null);

  const currentTask = findCurrentTask(tasks);
  const checkinTask = tasks.find((t) => t.id === activeCheckin?.task_id) ?? currentTask;

  async function handleSaveTask(values: NewTask, taskId?: string) {
    if (taskId) {
      await updateTask(taskId, values, "edited");
    } else {
      await createTask({ priority: profile?.default_priority ?? "medium", ...values });
    }
  }

  async function enableNotifications() {
    setPushError(null);
    try {
      const result = await enablePushNotifications();
      setPermission(result);
      if (result === "granted") await updateProfile({ notifications_enabled: true });
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Could not enable push notifications.");
    }
  }

  async function handleCheckinAction(action: "cut" | "shrink" | "move") {
    if (!checkinTask) {
      await resolve(action);
      return;
    }
    await resolve(action);
    setModal({ type: action, task: checkinTask });
  }

  return (
    <div className="space-y-6 pb-16">
      {permission === "default" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-forest/15 bg-forest/5 px-5 py-3.5">
          <p className="flex items-center gap-2 text-sm text-charcoal/70">
            <Bell className="h-4 w-4 text-forest" strokeWidth={1.75} />
            Turn on browser notifications so check-ins reach you even when the tab isn&rsquo;t open.
          </p>
          <Button variant="secondary" onClick={enableNotifications} className="shrink-0">
            Enable notifications
          </Button>
        </div>
      )}
      {pushError && <p className="text-sm text-[#B3492B]">{pushError}</p>}

      <div className="flex items-center justify-between">
        <TodayOverview tasks={tasks} />
      </div>

      {activeCheckin && (
        <RecoveryPanel
          checkin={activeCheckin}
          task={checkinTask ?? null}
          onCut={() => handleCheckinAction("cut")}
          onShrink={() => handleCheckinAction("shrink")}
          onMove={() => handleCheckinAction("move")}
          onDismiss={dismiss}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <CurrentTask
            task={currentTask}
            onStart={startTask}
            onPause={pauseTask}
            onComplete={completeTask}
            onEdit={(task) => setModal({ type: "edit", task })}
            onShrink={(task) => setModal({ type: "shrink", task })}
            onMove={(task) => setModal({ type: "move", task })}
            onCut={(task) => setModal({ type: "cut", task })}
          />

          <div className="flex items-center justify-between">
            <p className="eyebrow">Timeline</p>
            <Button variant="secondary" onClick={() => setModal({ type: "create" })}>
              <Plus className="h-4 w-4" /> Add task
            </Button>
          </div>
          <Timeline tasks={tasks} onSelect={(task) => setModal({ type: "edit", task })} />
        </div>

        <div className="space-y-6">
          <ProgressSummary tasks={tasks} />
        </div>
      </div>

      {(modal.type === "create" || modal.type === "edit") && (
        <TaskFormModal
          initial={modal.type === "edit" ? modal.task : null}
          defaultPriority={profile?.default_priority}
          onClose={() => setModal({ type: "none" })}
          onSave={handleSaveTask}
          onDelete={(id) => deleteTask(id).then(() => {})}
        />
      )}

      {modal.type === "shrink" && (
        <ShrinkModal
          task={modal.task}
          onClose={() => setModal({ type: "none" })}
          onConfirm={(newTitle, originalScope) => shrinkTask(modal.task.id, newTitle, originalScope).then(() => {})}
        />
      )}

      {modal.type === "move" && (
        <MoveModal
          task={modal.task}
          onClose={() => setModal({ type: "none" })}
          onConfirm={(start, end) => moveTask(modal.task.id, start, end, modal.task.move_count).then(() => {})}
        />
      )}

      {modal.type === "cut" && (
        <CutModal
          task={modal.task}
          onClose={() => setModal({ type: "none" })}
          onConfirm={() => cutTask(modal.task.id).then(() => {})}
        />
      )}
    </div>
  );
}
