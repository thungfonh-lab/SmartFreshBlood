import { freshLevel, FRESH_LEVEL_LABEL } from "@/lib/freshScore";
import type { BloodGroup } from "@/lib/types";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, unit, tone = "default" }: { label: string; value: string | number; unit?: string; tone?: "default" | "danger" | "warning" | "success" }) {
  const toneClass = {
    default: "text-slate-900 dark:text-slate-100",
    danger: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <Card>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-400">{unit}</span>}
      </p>
    </Card>
  );
}

const GROUP_COLORS: Record<BloodGroup, string> = {
  "O+": "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  "O-": "bg-red-200 text-red-800 dark:bg-red-900/70 dark:text-red-200",
  "A+": "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "A-": "bg-blue-200 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200",
  "B+": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "B-": "bg-emerald-200 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200",
  "AB+": "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  "AB-": "bg-purple-200 text-purple-800 dark:bg-purple-900/70 dark:text-purple-200",
};

export function BloodGroupBadge({ group }: { group: BloodGroup }) {
  return (
    <span className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 text-sm font-bold ${GROUP_COLORS[group]}`}>
      {group}
    </span>
  );
}

export function FreshScoreBar({ score }: { score: number }) {
  const level = freshLevel(score);
  const barColor = { fresh: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" }[level];
  const textColor = { fresh: "text-emerald-600 dark:text-emerald-400", medium: "text-amber-600 dark:text-amber-400", low: "text-red-600 dark:text-red-400" }[level];
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-semibold ${textColor}`}>
        {score} · {FRESH_LEVEL_LABEL[level]}
      </span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">{message}</p>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-200 border-t-red-600 dark:border-red-900 dark:border-t-red-500" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
      {message}
    </div>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
      {message}
    </div>
  );
}
