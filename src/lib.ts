import axios from 'axios';
import { useEffect, useState } from 'react';
import type * as T from './types';

/* ---------- HTTP (Axios -> JSON Server) ---------- */
export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 10000 });
export const get = async <R>(url: string, params?: Record<string, unknown>) => (await http.get<R>(url, { params })).data;
export const post = async <R>(url: string, body: object) => (await http.post<R>(url, body)).data;
export const patch = async <R>(url: string, body: object) => (await http.patch<R>(url, body)).data;
export const del = (url: string) => http.delete(url);

export const errMsg = (e: unknown): string => {
  if (axios.isAxiosError(e)) return e.response ? `Server error (${e.response.status}). Please try again.` : 'Cannot reach the server. Make sure JSON Server is running.';
  return e instanceof Error ? e.message : 'Something went wrong.';
};
export const now = () => new Date().toISOString();
export const today = () => new Date().toISOString().slice(0, 10);
export const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: d.length > 10 ? 'short' : undefined }) : '—';

/* ---------- data hook with loading / error / reload ---------- */
export function useFetch<R>(fn: () => Promise<R>, deps: unknown[] = []) {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    fn().then((d) => live && setData(d)).catch((e) => live && setError(errMsg(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

/* ---------- activity log + notifications ---------- */
export const logActivity = (entityType: T.Activity['entityType'], entityId: number, action: string, actorId: number, note = '') =>
  post('/activityLogs', { entityType, entityId, action, actorId, note, createdAt: now() });

export const notify = (userId: number, type: T.Notification['type'], message: string, link: string) =>
  post('/notifications', { userId, type, message, link, read: false, createdAt: now() });

export async function notifyStaff(type: T.Notification['type'], message: string, link: string) {
  const users = await get<T.User[]>('/users');
  await Promise.all(users.filter((u) => u.role !== 'user' && u.active !== false).map((u) => notify(u.id, type, message, link)));
}

/* ---------- search / filter / sort ---------- */
export interface Filters { q: string; category: string; location: string; date: string; status: string; sort: 'newest' | 'oldest' }
export const emptyFilters: Filters = { q: '', category: '', location: '', date: '', status: '', sort: 'newest' };
export interface Norm { name: string; cat: number; loc: string; date: string; status: string; created: string }

export const norm = (kind: 'lost' | 'found', i: any): Norm =>
  kind === 'lost'
    ? { name: i.itemName, cat: i.categoryId, loc: i.lastSeenLocation, date: i.lastSeenDate, status: i.status, created: i.createdAt }
    : { name: i.itemName, cat: i.categoryId, loc: i.foundLocation, date: i.foundDate, status: i.status, created: i.createdAt };

export function filterItems<X>(items: X[], f: Filters, n: (x: X) => Norm): X[] {
  const q = f.q.trim().toLowerCase(), l = f.location.trim().toLowerCase();
  return items
    .filter((x) => {
      const v = n(x);
      return (!q || v.name.toLowerCase().includes(q)) && (!f.category || String(v.cat) === f.category) &&
        (!l || v.loc.toLowerCase().includes(l)) && (!f.date || v.date >= f.date) && (!f.status || v.status === f.status);
    })
    .sort((a, b) => (f.sort === 'newest' ? -1 : 1) * n(a).created.localeCompare(n(b).created));
}

/* ---------- matching ---------- */
const STOP = new Set(['the', 'and', 'with', 'for', 'near', 'has', 'was', 'are', 'from', 'that', 'this']);
const tok = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
export const MATCH_MIN = 55;

/** Score 0-100: category 35, keywords up to 30, location 20, date window (found 0-14 days after last seen) 15. */
export function scoreMatch(l: T.LostReport, f: T.FoundItem): number {
  let s = l.categoryId === f.categoryId ? 35 : 0;
  const a = tok(`${l.itemName} ${l.description} ${l.identifyingDetails}`), b = tok(`${f.itemName} ${f.description}`);
  s += Math.min(30, [...a].filter((w) => b.has(w)).length * 10);
  const la = tok(l.lastSeenLocation), lb = tok(f.foundLocation);
  if ([...la].some((w) => lb.has(w))) s += 20;
  const days = (Date.parse(f.foundDate) - Date.parse(l.lastSeenDate)) / 864e5;
  if (days >= 0 && days <= 14) s += 15;
  return Math.min(100, s);
}

export async function generateMatches(kind: 'lost' | 'found', item: T.LostReport | T.FoundItem) {
  const others = kind === 'lost' ? await get<T.FoundItem[]>('/foundItems') : await get<T.LostReport[]>('/lostReports');
  const existing = await get<T.Match[]>('/matchSuggestions');
  for (const o of others) {
    const l = (kind === 'lost' ? item : o) as T.LostReport, f = (kind === 'lost' ? o : item) as T.FoundItem;
    if (['Returned', 'Closed'].includes(f.status) || ['Resolved', 'Closed'].includes(l.status)) continue;
    const score = scoreMatch(l, f);
    if (score < MATCH_MIN || existing.some((m) => m.lostId === l.id && m.foundId === f.id)) continue;
    await post('/matchSuggestions', { lostId: l.id, foundId: f.id, score, status: 'Suggested', decidedBy: null, createdAt: now() });
    await notify(l.userId, 'match', `Possible match for "${l.itemName}": found item "${f.itemName}" (${score}%).`, `/lost/${l.id}`);
  }
}

export async function decideMatch(m: T.Match, decision: 'Confirmed' | 'Dismissed', actor: T.User) {
  await patch(`/matchSuggestions/${m.id}`, { status: decision, decidedBy: actor.id });
  if (decision !== 'Confirmed') return;
  const l = await get<T.LostReport>(`/lostReports/${m.lostId}`);
  if (l.status === 'Open') await patch(`/lostReports/${l.id}`, { status: 'Matched' });
  await logActivity('lost', m.lostId, 'Match confirmed', actor.id, `Matched with found item #${m.foundId}`);
  await logActivity('found', m.foundId, 'Match confirmed', actor.id, `Matched with lost report #${m.lostId}`);
  if (l.userId !== actor.id) await notify(l.userId, 'match', `A match for "${l.itemName}" was confirmed. You can now submit a claim.`, `/found/${m.foundId}`);
}

/* ---------- claim + handover workflow ---------- */
export const ACTIVE_CLAIM: T.ClaimStatus[] = ['Submitted', 'Under Review', 'More Information Required'];

export async function submitClaim(input: { foundId: number; lostId: number | null; identifyingDetails: string; proofNotes: string }, user: T.User) {
  const [mine, found] = await Promise.all([get<T.Claim[]>('/claims', { foundId: input.foundId, userId: user.id }), get<T.FoundItem>(`/foundItems/${input.foundId}`)]);
  if (mine.some((c) => c.status !== 'Rejected')) throw new Error('You already have an active claim for this item.');
  if (!['In Storage', 'Claim Pending'].includes(found.status)) throw new Error('This item is no longer available to claim.');
  const claim = await post<T.Claim>('/claims', { ...input, userId: user.id, status: 'Submitted', infoRequest: '', createdAt: now(), updatedAt: now() });
  if (found.status === 'In Storage') await patch(`/foundItems/${found.id}`, { status: 'Claim Pending' });
  await logActivity('claim', claim.id, 'Claim submitted', user.id);
  await logActivity('found', found.id, 'Claim submitted', user.id, `Claim #${claim.id}`);
  await notifyStaff('claim', `New claim submitted for "${found.itemName}".`, '/queue');
  await notify(user.id, 'claim', `Your claim for "${found.itemName}" was submitted.`, '/claims');
  return claim;
}

export async function respondToInfoRequest(c: T.Claim, reply: string, user: T.User) {
  await patch(`/claims/${c.id}`, { proofNotes: `${c.proofNotes}\n[${fmt(now())}] ${reply}`, status: 'Under Review', updatedAt: now() });
  await logActivity('claim', c.id, 'Information provided', user.id, reply);
  await notifyStaff('claim', `Claim #${c.id}: the claimant replied to your information request.`, '/queue');
}

export async function reviewClaim(c: T.Claim, status: T.ClaimStatus, note: string, actor: T.User) {
  const [all, found] = await Promise.all([get<T.Claim[]>('/claims', { foundId: c.foundId }), get<T.FoundItem>(`/foundItems/${c.foundId}`)]);
  if (status === 'Approved' && all.some((x) => x.id !== c.id && x.status === 'Approved')) throw new Error('Another claim for this item is already approved.');
  await patch(`/claims/${c.id}`, { status, updatedAt: now(), infoRequest: status === 'More Information Required' ? note : c.infoRequest ?? '' });
  await post('/verifications', { claimId: c.id, verifierId: actor.id, status, note, createdAt: now() });
  await logActivity('claim', c.id, `Status: ${status}`, actor.id, note);
  const msg: Record<string, [T.Notification['type'], string]> = {
    'Under Review': ['claim', `Your claim for "${found.itemName}" is now under review.`],
    'More Information Required': ['info', `Staff needs more information for your claim on "${found.itemName}": ${note}`],
    Approved: ['handover', `Your claim for "${found.itemName}" is approved. It is being prepared for handover.`],
    Rejected: ['claim', `Your claim for "${found.itemName}" was rejected: ${note}`],
  };
  if (msg[status]) await notify(c.userId, msg[status][0], msg[status][1], '/claims');
  if (status === 'Approved') {
    const h = await post<T.Handover>('/handovers', { claimId: c.id, foundId: c.foundId, userId: c.userId, status: 'Ready for Handover', verifierId: null, handoverDate: null, note: '', createdAt: now() });
    await logActivity('handover', h.id, 'Ready for Handover', actor.id, `Claim #${c.id}`);
  }
  if (status === 'Rejected' && !all.some((x) => x.id !== c.id && ACTIVE_CLAIM.includes(x.status)) && found.status === 'Claim Pending')
    await patch(`/foundItems/${found.id}`, { status: 'In Storage' });
}

export async function completeHandover(h: T.Handover, actor: T.User, date: string, verifierId: number, note: string) {
  const c = await get<T.Claim>(`/claims/${h.claimId}`);
  await patch(`/handovers/${h.id}`, { status: 'Handed Over', handoverDate: date, verifierId, note });
  await patch(`/foundItems/${h.foundId}`, { status: 'Returned' });
  if (c.lostId) await patch(`/lostReports/${c.lostId}`, { status: 'Resolved' });
  await logActivity('handover', h.id, 'Handed Over', actor.id, `On ${date}. ${note}`);
  await logActivity('found', h.foundId, 'Item returned to owner', actor.id);
  await notify(h.userId, 'handover', 'Your item has been handed over. Thank you!', '/claims');
}

export async function closeHandover(h: T.Handover, actor: T.User) {
  await patch(`/handovers/${h.id}`, { status: 'Closed' });
  await patch(`/foundItems/${h.foundId}`, { status: 'Closed' });
  await logActivity('handover', h.id, 'Closed', actor.id);
  await notify(h.userId, 'handover', 'Your handover case has been closed.', '/claims');
}
