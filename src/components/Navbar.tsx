import { Link2 } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/match", label: "Live Matching" },
  { to: "/results", label: "Evaluation" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-blue-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1500px] items-center gap-6 px-5">
        <NavLink to="/match" className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
            <Link2 size={17} strokeWidth={2.4} />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <strong className="truncate text-[17px] font-bold text-blue-900">MT-Link</strong>
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-blue-400">
              Interactive Demo
            </span>
          </span>
        </NavLink>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-blue-50/60 hover:text-blue-600",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <span className="hidden shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600 sm:inline">
          Trained checkpoints · no retraining
        </span>
      </div>
    </header>
  );
}
