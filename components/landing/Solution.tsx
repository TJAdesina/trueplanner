const STEPS = [
  {
    n: "01",
    title: "Plan",
    body: "Set up your day with realistic tasks and time windows.",
  },
  {
    n: "02",
    title: "Detect",
    body: "The app notices when a task is overdue or your day is falling behind.",
  },
  {
    n: "03",
    title: "Adjust",
    body: "Choose whether to cut the task, shrink it, or move it.",
  },
  {
    n: "04",
    title: "Continue",
    body: "Return to a clearer plan with a useful next action.",
  },
];

export function Solution() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-28">
      <div className="content-wrap">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-medium text-forest sm:text-4xl">
            When the plan breaks, make a better next move.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/70">
            The app notices when your schedule starts to drift and helps you
            respond before the entire day disappears.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-card border border-charcoal/10 p-6">
              <span className="font-serif text-2xl text-charcoal/25">{step.n}</span>
              <h3 className="mt-3 font-serif text-xl text-forest">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/65">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
