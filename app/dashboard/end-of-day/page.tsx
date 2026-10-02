"use client";

import { useEffect, useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import { formatFriendlyDate } from "@/lib/time";
import { summarizeProgress } from "@/lib/taskUtils";
import type { DailyReview } from "@/lib/dailyReview";

export default function EndOfDayPage() {
  const { tasks, loading } = useTasks();
  const [review, setReview] = useState<DailyReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewError, setReviewError] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (tasks.length === 0) {
      setReviewLoading(false);
      return;
    }

    let cancelled = false;
    fetch("/api/end-of-day")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the daily review.");
        return response.json();
      })
      .then(({ review: dailyReview }) => {
        if (!cancelled) setReview(dailyReview as DailyReview);
      })
      .catch(() => {
        if (!cancelled) setReviewError(true);
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, tasks.length]);

  if (loading) {
    return <p className="text-sm text-charcoal/50">Loading today&rsquo;s summary\u2026</p>;
  }

  const c = summarizeProgress(tasks);
  const meaningful = c.completed + c.shrunk + c.started;

  const rows = [
    { label: "Completed", value: c.completed, note: "Finished exactly as planned, or close to it." },
    { label: "Started", value: c.started, note: "Real progress, even if not finished." },
    { label: "Shrunk", value: c.shrunk, note: "Reduced to a meaningful outcome you could actually reach." },
    { label: "Moved", value: c.moved, note: "Still important \u2014 intentionally rescheduled." },
    { label: "Cut", value: c.cut, note: "Let go of on purpose, not by accident." },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <p className="eyebrow">{formatFriendlyDate()}</p>
        <h1 className="mt-1 font-serif text-3xl text-forest">End of day</h1>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-charcoal/60">
            No tasks were planned today. Tomorrow&rsquo;s a good place to
            start.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-6">
            <p className="font-serif text-lg text-forest">
              {meaningful > 0
                ? `You made progress on ${meaningful} of ${tasks.length} planned tasks today.`
                : `Today didn\u2019t go to plan \u2014 and that\u2019s alright.`}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
              Here&rsquo;s an honest picture of where things landed, not just
              what got crossed off.
            </p>
          </div>

          {reviewLoading && (
            <p className="text-sm text-charcoal/55">Preparing your reflection...</p>
          )}
          {reviewError && (
            <p className="text-sm text-charcoal/65">
              Your statistics are ready, but the written reflection could not be loaded. Refresh to try again.
            </p>
          )}
          {review && (
            <>
              <div className="card p-6">
                <p className="font-serif text-lg leading-relaxed text-forest">{review.assessment}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-forest">What went well</h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-charcoal/75">
                    {review.wentWell.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </section>
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-forest">What to improve</h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-charcoal/75">
                    {review.improve.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </section>
                <section className="card p-5">
                  <h2 className="text-sm font-semibold text-forest">Plan for tomorrow</h2>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-charcoal/75">
                    {review.planTomorrow.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </section>
              </div>
            </>
          )}

          <div className="card divide-y divide-charcoal/8 p-6">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-charcoal">{r.label}</p>
                  <p className="mt-0.5 text-xs text-charcoal/50">{r.note}</p>
                </div>
                <span className="font-serif text-2xl text-forest">{r.value}</span>
              </div>
            ))}
          </div>

          {c.moved > 0 && (
            <div className="card border-charcoal/10 bg-cream/60 p-6">
              <p className="text-sm text-charcoal/65">
                {c.moved} task{c.moved > 1 ? "s are" : " is"} waiting for you
                tomorrow. They&rsquo;ll be right there on your timeline.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
