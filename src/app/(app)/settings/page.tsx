"use client";

const sections = [
  {
    code: "01",
    title: "Profile",
    desc: "Name, avatar, handle",
  },
  {
    code: "02",
    title: "Wallet",
    desc: "Connected addresses, signing preferences",
  },
  {
    code: "03",
    title: "AI behavior",
    desc: "Model, risk tolerance, autonomy level",
  },
  {
    code: "04",
    title: "Notifications",
    desc: "Email, push, on-chain alerts",
  },
  {
    code: "05",
    title: "Billing",
    desc: "Plan, usage, invoices",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          settings / preferences
        </div>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tighter">
          Make it <span className="italic text-lime">yours</span>.
        </h1>
      </div>

      <div className="grid gap-px bg-white/5 hairline rounded-2xl overflow-hidden">
        {sections.map((s) => (
          <button
            key={s.code}
            className="bg-background hover:bg-white/[0.02] transition p-5 sm:p-6 text-left grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 group"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {s.code}
            </span>
            <div className="min-w-0">
              <div className="font-display text-xl text-white group-hover:text-lime transition">
                {s.title}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
            <span className="text-muted-foreground group-hover:text-lime transition">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
