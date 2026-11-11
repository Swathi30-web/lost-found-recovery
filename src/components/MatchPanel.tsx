import { useState } from 'react';
import { useAuth } from '../auth';
import { decideMatch, errMsg, get, useFetch } from '../lib';
import type { Category, FoundItem, LostReport, Match } from '../types';
import { Badge, btnGhost, btnOk, card, catIcon, Empty, ErrorBox, Flash, ItemImage, ItemLink, Spinner } from './ui';

/** Possible matches (optionally scoped to one lost report / found item). Users or staff confirm or dismiss them. */
export default function MatchPanel({ lostId, foundId }: { lostId?: number; foundId?: number }) {
  const { user } = useAuth();
  const staff = user!.role !== 'user';
  const [ok, setOk] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(0);
  const q = useFetch(async () => {
    const [m, l, f, cats] = await Promise.all([get<Match[]>('/matchSuggestions', { lostId, foundId }), get<LostReport[]>('/lostReports'), get<FoundItem[]>('/foundItems'), get<Category[]>('/categories')]);
    return { m, l, f, cats };
  }, [lostId, foundId]);

  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { l, f, cats } = q.data;
  const icon = (id?: number) => catIcon(cats.find((c) => c.id === id)?.name);
  const rows = q.data.m
    .map((m) => ({ m, lost: l.find((x) => x.id === m.lostId), found: f.find((x) => x.id === m.foundId) }))
    .filter((r) => r.lost && r.found && (staff || r.lost.userId === user!.id))
    .sort((a, b) => b.m.score - a.m.score);

  const decide = async (m: Match, d: 'Confirmed' | 'Dismissed') => {
    setBusy(m.id); setErr(''); setOk('');
    try { await decideMatch(m, d, user!); setOk(`Match ${d.toLowerCase()}.`); q.reload(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(0); }
  };

  return (
    <div className="space-y-3">
      <Flash ok={ok} err={err} />
      {!rows.length && <Empty text="No possible matches yet. New reports are matched automatically by category, keywords, location and date." />}
      {rows.map(({ m, lost, found }) => (
        <div key={m.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex shrink-0 items-center gap-1.5" aria-label="Lost item and found item photos">
            <ItemImage src={lost!.image} alt={`Lost: ${lost!.itemName}`} icon={icon(lost!.categoryId)} iconClass="text-2xl" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
            <span aria-hidden="true" className="text-slate-300">⇄</span>
            <ItemImage src={found!.image} alt={`Found: ${found!.itemName}`} icon={icon(found!.categoryId)} iconClass="text-2xl" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div><span className="text-slate-500">Lost:</span> <ItemLink kind="lost" id={lost!.id}>{lost!.itemName}</ItemLink> <span className="text-slate-400">({lost!.lastSeenLocation})</span></div>
            <div><span className="text-slate-500">Found:</span> <ItemLink kind="found" id={found!.id}>{found!.itemName}</ItemLink> <span className="text-slate-400">({found!.foundLocation})</span></div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 w-32 overflow-hidden rounded bg-slate-200"><div className="h-2 bg-indigo-500" style={{ width: `${m.score}%` }} /></div>
              <span className="text-xs text-slate-500">{m.score}% match</span><Badge s={m.status} />
            </div>
          </div>
          {m.status === 'Suggested' && (staff || lost!.userId === user!.id) && (
            <div className="flex gap-2">
              <button disabled={busy === m.id} onClick={() => decide(m, 'Confirmed')} className={btnOk}>Confirm</button>
              <button disabled={busy === m.id} onClick={() => decide(m, 'Dismissed')} className={btnGhost}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
