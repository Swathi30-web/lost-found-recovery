import { useState } from 'react';
import { useAuth } from '../auth';
import { Badge, btnGhost, btnOk, btnPrimary, card, Empty, ErrorBox, Field, Flash, History, inp, PageHeader, Spinner } from '../components/ui';
import { closeHandover, completeHandover, errMsg, fmt, get, today, useFetch } from '../lib';
import { HANDOVER_STATUSES, type Claim, type FoundItem, type Handover, type User } from '../types';

export default function Handovers() {
  const { user } = useAuth();
  const [status, setStatus] = useState(''); const [sort, setSort] = useState('newest');
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  const q = useFetch(async () => {
    const [h, found, users, claims] = await Promise.all([get<Handover[]>('/handovers'), get<FoundItem[]>('/foundItems'), get<User[]>('/users'), get<Claim[]>('/claims')]);
    return { h, found, users, claims };
  });
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { found, users } = q.data;
  const rows = q.data.h.filter((h) => !status || h.status === status).sort((a, b) => (sort === 'newest' ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));
  const verifiers = users.filter((u) => u.role !== 'user');
  const done = (m: string) => { setOk(m); setErr(''); q.reload(); };

  return (
    <>
      <PageHeader title="Handover Management" sub="Approved claims move through Ready for Handover → Handed Over → Closed." />
      <div className={`${card} mb-4 flex flex-wrap gap-3`}>
        <select aria-label="Handover status" className={`${inp} mt-0 max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Status: all</option>{HANDOVER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Sort" className={`${inp} mt-0 max-w-xs`} value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
      </div>
      <div className="mb-3"><Flash ok={ok} err={err} /></div>
      {!rows.length ? <Empty text="No handovers found. Approve a claim to create one." /> : (
        <div className="space-y-4">
          {rows.map((h) => <HandoverCard key={h.id} h={h} item={found.find((f) => f.id === h.foundId)} claimant={users.find((u) => u.id === h.userId)?.name} verifier={users.find((u) => u.id === h.verifierId)?.name} verifiers={verifiers} me={user!} onDone={done} onErr={setErr} />)}
        </div>
      )}
    </>
  );
}

function HandoverCard({ h, item, claimant, verifier, verifiers, me, onDone, onErr }: { h: Handover; item?: FoundItem; claimant?: string; verifier?: string; verifiers: User[]; me: User; onDone: (m: string) => void; onErr: (m: string) => void }) {
  const [form, setForm] = useState(false); const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(today()); const [vid, setVid] = useState(String(me.id)); const [note, setNote] = useState(''); const [fe, setFe] = useState('');
  const [hist, setHist] = useState(false);

  const complete = async () => {
    if (!date || date > today()) return setFe('Handover date is required and cannot be in the future.');
    setBusy(true); setFe('');
    try { await completeHandover(h, me, date, Number(vid), note.trim()); setForm(false); onDone(`Handover #${h.id} recorded.`); } catch (e) { onErr(errMsg(e)); } finally { setBusy(false); }
  };
  const close = async () => { setBusy(true); try { await closeHandover(h, me); onDone(`Handover #${h.id} closed.`); } catch (e) { onErr(errMsg(e)); } finally { setBusy(false); } };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-semibold">{item?.itemName ?? 'Item'} <span className="text-sm font-normal text-slate-500">· Claim #{h.claimId}</span></h3>
          <p className="text-sm text-slate-600">Claimant: {claimant} · Storage: {item?.storageLocation}</p></div>
        <Badge s={h.status} />
      </div>
      {h.status !== 'Ready for Handover' && <p className="mt-2 text-sm text-slate-600">Handover date: <b>{fmt(h.handoverDate)}</b> · Verified by: <b>{verifier ?? '—'}</b>{h.note && <> · Note: {h.note}</>}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {h.status === 'Ready for Handover' && !form && <button onClick={() => setForm(true)} className={btnPrimary}>Record handover</button>}
        {h.status === 'Handed Over' && <button disabled={busy} onClick={close} className={btnOk}>Close case</button>}
        <button onClick={() => setHist(!hist)} className={btnGhost}>{hist ? 'Hide' : 'Show'} history</button>
      </div>
      {form && (
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
          <Field label="Handover date *" error={fe}><input type="date" max={today()} className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Verifier *"><select className={inp} value={vid} onChange={(e) => setVid(e.target.value)}>{verifiers.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
          <Field label="Note"><input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ID checked" /></Field>
          <div className="flex gap-2 sm:col-span-3"><button disabled={busy} onClick={complete} className={btnOk}>Confirm handover</button><button onClick={() => setForm(false)} className={btnGhost}>Cancel</button></div>
        </div>
      )}
      {hist && <div className="mt-3"><History type="handover" id={h.id} /></div>}
    </div>
  );
}
