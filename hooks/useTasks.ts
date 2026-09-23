import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NewTask, Task, TaskStatus } from "@/lib/types";
import { endOfDay, startOfDay } from "@/lib/time";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const from = startOfDay().toISOString();
    const to = endOfDay().toISOString();

    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", from)
      .lte("start_time", to)
      .order("start_time", { ascending: true });

    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logEvent = useCallback(
    async (userId: string, taskId: string, eventType: string, detail?: string) => {
      const supabase = createClient();
      await supabase
        .from("task_events")
        .insert({ user_id: userId, task_id: taskId, event_type: eventType, detail: detail ?? null });
    },
    []
  );

  const createTask = useCallback(async (input: NewTask) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in" };

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();

    if (!error && data) {
      await logEvent(user.id, data.id, "created");
      setTasks((prev) => [...prev, data as Task].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
    }
    return { data, error };
  }, [logEvent]);

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Task>, eventType?: string, detail?: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: "Not signed in" };

      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", taskId)
        .select()
        .single();

      if (!error && data) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? (data as Task) : t)));
        if (eventType) await logEvent(user.id, taskId, eventType, detail);
      }
      return { data, error };
    },
    [logEvent]
  );

  const deleteTask = useCallback(async (taskId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (!error) setTasks((prev) => prev.filter((t) => t.id !== taskId));
    return { error };
  }, []);

  // --- Recovery actions -------------------------------------------------

  const startTask = (taskId: string) =>
    updateTask(taskId, { status: "in_progress" as TaskStatus }, "started");

  const pauseTask = (taskId: string) =>
    updateTask(taskId, { status: "paused" as TaskStatus }, "paused");

  const completeTask = (taskId: string) =>
    updateTask(taskId, { status: "completed" as TaskStatus }, "completed");

  const cutTask = (taskId: string) =>
    updateTask(taskId, { status: "cut" as TaskStatus }, "cut");

  const shrinkTask = (taskId: string, newTitle: string, originalScope: string) =>
    updateTask(
      taskId,
      { status: "shrunk" as TaskStatus, title: newTitle, original_scope: originalScope },
      "shrunk",
      `Reduced from: ${originalScope}`
    );

  const moveTask = (taskId: string, newStart: string, newEnd: string, currentMoveCount: number) =>
    updateTask(
      taskId,
      {
        status: "moved" as TaskStatus,
        start_time: newStart,
        end_time: newEnd,
        move_count: currentMoveCount + 1,
      },
      "moved",
      `Rescheduled to ${new Date(newStart).toLocaleString()}`
    );

  const reopenTask = (taskId: string) =>
    updateTask(taskId, { status: "not_started" as TaskStatus }, "reopened");

  return {
    tasks,
    loading,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    startTask,
    pauseTask,
    completeTask,
    cutTask,
    shrinkTask,
    moveTask,
    reopenTask,
  };
}
