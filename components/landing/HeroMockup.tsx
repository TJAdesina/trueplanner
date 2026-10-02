export function HeroMockup() {
  return (
    <div className="card relative w-full max-w-[420px] overflow-hidden p-0 shadow-soft">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-charcoal/10 bg-cream/60 px-4 py-3">
        <span className="text-xs font-medium text-charcoal/60">Today \u00b7 Thursday, June 12</span>
        <span className="rounded-full bg-peach/25 px-2 py-0.5 text-[11px] font-medium text-charcoal">
          Plan needs adjustment
        </span>
      </div>

      <div className="space-y-4 p-4">
        {/* timeline */}
        <div className="space-y-2">
          <TimelineRow time="9:00" title="Write chapter one" status="done" />
          <TimelineRow time="11:30" title="Respond to client emails" status="done" />
          <TimelineRow time="1:00" title="Prepare client presentation" status="overdue" />
        </div>

        {/* recovery card */}
        <div className="rounded-card border border-peach/40 bg-peach/10 p-3.5">
          <p className="font-serif text-[15px] leading-snug text-forest">
            Your plan is getting tight.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-charcoal/75">
            You still have an unfinished task and limited time left. Choose a realistic next step.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-charcoal/15 bg-surface px-3 py-1 text-[12px] font-medium text-charcoal">
              Cut it
            </span>
            <span className="rounded-full border border-forest/25 bg-forest px-3 py-1 text-[12px] font-medium text-cream">
              Shrink it
            </span>
            <span className="rounded-full border border-charcoal/15 bg-surface px-3 py-1 text-[12px] font-medium text-charcoal">
              Move it
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  time,
  title,
  status,
}: {
  time: string;
  title: string;
  status: "done" | "overdue";
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-charcoal/8 bg-surface px-3 py-2.5">
      <span className="w-11 shrink-0 text-[11px] font-medium text-charcoal/45">{time}</span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          status === "done" ? "bg-green" : "bg-peach"
        }`}
      />
      <span
        className={`flex-1 text-[13px] ${
          status === "done" ? "text-charcoal/45 line-through" : "font-medium text-charcoal"
        }`}
      >
        {title}
      </span>
      {status === "overdue" && (
        <span className="shrink-0 text-[11px] font-medium text-[#C4732B]">
          overdue
        </span>
      )}
    </div>
  );
}
