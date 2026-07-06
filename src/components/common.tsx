/** Small shared presentational components. */
import React from 'react';
import type { TransparencyWarning, WarningLevel } from '../types/model';

const LEVEL_STYLES: Record<WarningLevel, string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-900',
  caution: 'bg-amber-50 border-amber-200 text-amber-900',
  warning: 'bg-rose-50 border-rose-200 text-rose-900',
};

const LEVEL_ICON: Record<WarningLevel, string> = { info: 'ℹ', caution: '⚠', warning: '⚠' };

export function WarningList({ warnings, title }: { warnings: TransparencyWarning[]; title?: string }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-slate-700">{title}</h3>}
      {warnings.map((w) => (
        <div key={w.id} className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${LEVEL_STYLES[w.level]}`}>
          <span aria-hidden className="font-bold">{LEVEL_ICON[w.level]}</span>
          <span>{w.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-semibold text-ocean-800">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-ocean-900">{children}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'ocean' | 'green' | 'amber' | 'rose' | 'purple' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    ocean: 'bg-ocean-100 text-ocean-800',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    purple: 'bg-purple-100 text-purple-800',
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-lg font-medium text-slate-600">{title}</div>
      {children && <div className="max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function InfoBanner({ children, tone = 'info' }: { children: React.ReactNode; tone?: WarningLevel }) {
  return <div className={`rounded-md border px-3 py-2 text-sm ${LEVEL_STYLES[tone]}`}>{children}</div>;
}
