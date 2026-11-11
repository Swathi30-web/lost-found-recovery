import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { get, useFetch, fmt, type Filters, emptyFilters } from '../lib';
import type { Activity, Category, User } from '../types';

export const inp = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
export const btn = 'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;
export const btnOk = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;
export const card = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

const COLORS: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-800', Matched: 'bg-purple-100 text-purple-800', Resolved: 'bg-emerald-100 text-emerald-800', Closed: 'bg-slate-200 text-slate-700',
  'In Storage': 'bg-blue-100 text-blue-800', 'Claim Pending': 'bg-amber-100 text-amber-800', Returned: 'bg-emerald-100 text-emerald-800',
  Submitted: 'bg-blue-100 text-blue-800', 'Under Review': 'bg-amber-100 text-amber-800', 'More Information Required': 'bg-orange-100 text-orange-800',
  Approved: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-red-100 text-red-800',
  'Ready for Handover': 'bg-indigo-100 text-indigo-800', 'Handed Over': 'bg-emerald-100 text-emerald-800',
  Suggested: 'bg-amber-100 text-amber-800', Confirmed: 'bg-emerald-100 text-emerald-800', Dismissed: 'bg-slate-200 text-slate-700',
};
export const Badge = ({ s }: { s: string }) => <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[s] || 'bg-slate-100 text-slate-700'}`}>{s}</span>;

export const Spinner = () => (
  <div className="flex items-center justify-center gap-3 py-12 text-slate-500" role="status">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /> Loading…
  </div>
);
export const ErrorBox = ({ msg, onRetry }: { msg: string; onRetry?: () => void }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
    {msg} {onRetry && <button onClick={onRetry} className="ml-2 font-medium underline">Retry</button>}
  </div>
);
export const Empty = ({ text, action }: { text: string; action?: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
    <p>{text}</p>{action && <div className="mt-3">{action}</div>}
  </div>
);
export const Flash = ({ ok, err }: { ok?: string; err?: string }) =>
  ok ? <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">✓ {ok}</div>
  : err ? <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div> : null;

export const PageHeader = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>
    <div className="flex flex-wrap gap-2">{actions}</div>
  </div>
);
export const Field = ({ label, error, children }: { label: string; error?: string; children: ReactNode }) => (
  <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>
);
const TONES: Record<string, string> = { indigo: 'border-l-indigo-500', blue: 'border-l-blue-500', amber: 'border-l-amber-500', emerald: 'border-l-emerald-500', purple: 'border-l-purple-500', red: 'border-l-red-500' };
export const Stat = ({ label, value, tone = 'indigo' }: { label: string; value: number | string; tone?: string }) => (
  <div className={`${card} border-l-4 ${TONES[tone]}`}>
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
  </div>
);

/** Emoji shown when an item has no photo (or its photo fails to load), chosen by category name. */
const CAT_ICONS: Record<string, string> = {
  Electronics: '📱', 'Wallets & Bags': '👜', Keys: '🔑', Documents: '📄', Clothing: '👕', Jewellery: '💍', Other: '📦',
};
export const catIcon = (categoryName?: string) => CAT_ICONS[categoryName ?? ''] ?? '📦';

/**
 * Item photo with a graceful fallback. Pass the sizing / shape classes in `className`
 * (e.g. "h-40 w-full rounded-lg object-cover"); the fallback tile reuses the same box.
 */
export function ItemImage({ src, alt, icon = '📦', className = '', iconClass = 'text-4xl' }: { src?: string; alt: string; icon?: string; className?: string; iconClass?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (src && !broken) return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={className} />;
  return (
    <div role="img" aria-label={`${alt} (no photo)`} className={`flex items-center justify-center bg-slate-100 ${className}`}>
      <span aria-hidden="true" className={iconClass}>{icon}</span>
    </div>
  );
}

export function ImageInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [err, setErr] = useState('');
  const pick = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('Please choose an image file.');
    if (f.size > 700 * 1024) return setErr('Image must be smaller than 700 KB.');
    setErr('');
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <div>
      <span className="text-sm font-medium text-slate-700">Image (optional)</span>
      <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} className="mt-1 block w-full text-sm" />
      {(err || error) && <span className="text-xs text-red-600">{err || error}</span>}
      {value && (
        <div className="mt-2 flex items-center gap-3">
          <img src={value} alt="Preview" className="h-24 w-24 rounded-lg border object-cover" />
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-600 underline">Remove</button>
        </div>
      )}
    </div>
  );
}

export function FilterBar({ f, set, cats, statuses, statusLabel }: { f: Filters; set: (f: Filters) => void; cats: Category[]; statuses: readonly string[]; statusLabel: string }) {
  const up = (k: keyof Filters, v: string) => set({ ...f, [k]: v } as Filters);
  return (
    <div className={`${card} mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
      <input aria-label="Search item name" placeholder="Search item name…" className={inp} value={f.q} onChange={(e) => up('q', e.target.value)} />
      <select aria-label="Category" className={inp} value={f.category} onChange={(e) => up('category', e.target.value)}>
        <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input aria-label="Location" placeholder="Location…" className={inp} value={f.location} onChange={(e) => up('location', e.target.value)} />
      <input aria-label="Date from" type="date" title="On or after this date" className={inp} value={f.date} onChange={(e) => up('date', e.target.value)} />
      <select aria-label={statusLabel} className={inp} value={f.status} onChange={(e) => up('status', e.target.value)}>
        <option value="">{statusLabel}: all</option>{statuses.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select aria-label="Sort" className={inp} value={f.sort} onChange={(e) => up('sort', e.target.value)}>
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
      </select>
      <button onClick={() => set(emptyFilters)} className={btnGhost}>Reset filters</button>
    </div>
  );
}

/** Timestamped activity history for a lost report, found item, claim or handover. */
export function History({ type, id }: { type: Activity['entityType']; id: number }) {
  const q = useFetch(async () => {
    const [logs, users] = await Promise.all([get<Activity[]>('/activityLogs', { entityType: type, entityId: id, _sort: 'createdAt', _order: 'desc' }), get<User[]>('/users')]);
    return { logs, users };
  }, [type, id]);
  if (q.loading) return <p className="text-sm text-slate-400">Loading history…</p>;
  if (q.error || !q.data) return <p className="text-sm text-red-600">{q.error}</p>;
  if (!q.data.logs.length) return <p className="text-sm text-slate-400">No activity yet.</p>;
  return (
    <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
      {q.data.logs.map((l) => (
        <li key={l.id} className="text-sm">
          <div className="font-medium text-slate-800">{l.action}</div>
          <div className="text-xs text-slate-500">{fmt(l.createdAt)} · {q.data!.users.find((u) => u.id === l.actorId)?.name ?? 'System'}</div>
          {l.note && <div className="text-xs text-slate-600">{l.note}</div>}
        </li>
      ))}
    </ol>
  );
}

export const ItemLink = ({ kind, id, children }: { kind: 'lost' | 'found'; id: number; children: ReactNode }) => (
  <Link to={`/${kind}/${id}`} className="font-medium text-indigo-600 hover:underline">{children}</Link>
);
