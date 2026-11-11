import { useState } from 'react';
import { useAuth } from '../auth';
import { Badge, btnDanger, btnGhost, btnOk, btnPrimary, card, catIcon, Empty, ErrorBox, Flash, History, inp, ItemImage, ItemLink, PageHeader, Spinner } from '../components/ui';
import { emptyFilters, errMsg, fmt, get, respondToInfoRequest, reviewClaim, useFetch, type Filters } from '../lib';
import { CLAIM_STATUSES, type Category, type Claim, type ClaimStatus, type FoundItem, type Handover, type User } from '../types';

/** "My Claims" for users; "Claim Verification Queue" for staff/admin (queue prop). */
export default function Claims({ queue }: { queue?: boolean }) {
  const { user } = useAuth();
  const [f, setF] = useState<Filters>(emptyFilters);
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  const q = useFetch(async () => {
    const [claims, found, users, cats, hand] = await Promise.all([
      get<Claim[]>('/claims', queue ? undefined : { userId: user!.id }), get<FoundItem[]>('/foundItems'), get<User[]>('/users'), get<Category[]>('/categories'), get<Handover[]>('/handovers'),
    ]);
    return { claims, found, users, cats, hand };
  }, [queue]);
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { found, users, cats, hand } = q.data;
  const up = (k: keyof Filters, v: string) => setF({ ...f, [k]: v } as Filters);

  const rows = q.data.claims
    .filter((c) => {
      const fi = found.find((x) => x.id === c.foundId);
      return (!f.q || fi?.itemName.toLowerCase().includes(f.q.toLowerCase())) && (!f.category || String(fi?.categoryId) === f.category) &&
        (!f.location || fi?.foundLocation.toLowerCase().includes(f.location.toLowerCase())) && (!f.date || c.createdAt.slice(0, 10) >= f.date) && (!f.status || c.status === f.status);
    })
    .sort((a, b) => (f.sort === 'newest' ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));

  return (
    <>
      <PageHeader title={queue ? 'Claim Verification Queue' : 'My Claims'} sub={queue ? 'Review proof, request information, approve or reject.' : 'Track the status of your ownership claims.'} />
      <div className={`${card} mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <input placeholder="Item name…" aria-label="Item name" className={inp} value={f.q} onChange={(e) => up('q', e.target.value)} />
        <select aria-label="Category" className={inp} value={f.category} onChange={(e) => up('category', e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <input placeholder="Location…" aria-label="Location" className={inp} value={f.location} onChange={(e) => up('location', e.target.value)} />
        <input type="date" aria-label="Claimed on or after" title="Claimed on or after" className={inp} value={f.date} onChange={(e) => up('date', e.target.value)} />
        <select aria-label="Claim status" className={inp} value={f.status} onChange={(e) => up('status', e.target.value)}><option value="">Claim status: all</option>{CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Sort" className={inp} value={f.sort} onChange={(e) => up('sort', e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <button className={btnGhost} onClick={() => setF(emptyFilters)}>Reset filters</button>
      </div>
      <div className="mb-3"><Flash ok={ok} err={err} /></div>
      {!rows.length ? <Empty text={q.data.claims.length ? 'No claims match your filters.' : queue ? 'No claims to review.' : 'You have not submitted any claims yet. Open a found item and click "Submit claim".'} /> : (
        <div className="space-y-4">
          {rows.map((c) => (
            <ClaimCard key={c.id} c={c} fi={found.find((x) => x.id === c.foundId)} icon={catIcon(cats.find((k) => k.id === found.find((x) => x.id === c.foundId)?.categoryId)?.name)} who={users.find((u) => u.id === c.userId)?.name} handover={hand.find((h) => h.claimId === c.id)}
              queue={!!queue} onDone={(m) => { setOk(m); setErr(''); q.reload(); }} onErr={(m) => { setErr(m); setOk(''); }} />
          ))}
        </div>
      )}
    </>
  );
}

function ClaimCard({ c, fi, icon, who, handover, queue, onDone, onErr }: { c: Claim; fi?: FoundItem; icon: string; who?: string; handover?: Handover; queue: boolean; onDone: (m: string) => void; onErr: (m: string) => void }) {
  const { user } = useAuth();
  const [note, setNote] = useState(''); const [reply, setReply] = useState(''); const [hist, setHist] = useState(false); const [busy, setBusy] = useState(false); const [localErr, setLocalErr] = useState('');

  const act = async (s: ClaimStatus) => {
    if (['Rejected', 'More Information Required'].includes(s) && note.trim().length < 5) return setLocalErr('A note (min 5 characters) is required for this action.');
    setBusy(true); setLocalErr('');
    try { await reviewClaim(c, s, note.trim(), user!); setNote(''); onDone(`Claim #${c.id} → ${s}.`); } catch (e) { onErr(errMsg(e)); } finally { setBusy(false); }
  };
  const respond = async () => {
    if (reply.trim().length < 5) return setLocalErr('Please enter the requested information (min 5 characters).');
    setBusy(true); setLocalErr('');
    try { await respondToInfoRequest(c, reply.trim(), user!); setReply(''); onDone('Information sent to staff.'); } catch (e) { onErr(errMsg(e)); } finally { setBusy(false); }
  };
  const open = ['Submitted', 'Under Review', 'More Information Required'].includes(c.status);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <ItemImage src={fi?.image} alt={fi?.itemName ?? 'Item removed'} icon={icon} iconClass="text-2xl" className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover" />
          <div>
            <h3 className="font-semibold">Claim #{c.id}: {fi ? <ItemLink kind="found" id={fi.id}>{fi.itemName}</ItemLink> : 'Item removed'}</h3>
            <p className="text-xs text-slate-500">{queue && <>By {who} · </>}Submitted {fmt(c.createdAt)} · Updated {fmt(c.updatedAt)}</p>
          </div>
        </div>
        <Badge s={c.status} />
      </div>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div><div className="text-slate-500">Identifying details</div>{c.identifyingDetails}</div>
        <div><div className="text-slate-500">Proof notes</div><div className="whitespace-pre-line">{c.proofNotes}</div></div>
        {queue && fi && <div><div className="text-slate-500">Storage location</div>{fi.storageLocation}</div>}
      </div>
      {c.status === 'More Information Required' && c.infoRequest && <div className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-900"><b>Information requested:</b> {c.infoRequest}</div>}
      {handover && c.status === 'Approved' && (
        <div className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm">Handover: <Badge s={handover.status} />
          {handover.handoverDate && <> on {fmt(handover.handoverDate)}</>}{!queue && handover.status === 'Ready for Handover' && <> — bring a valid ID to the storage desk.</>}</div>
      )}
      {localErr && <div className="mt-3 text-sm text-red-600" role="alert">{localErr}</div>}

      {!queue && c.status === 'More Information Required' && c.userId === user!.id && (
        <div className="mt-3 space-y-2"><textarea rows={2} className={inp} placeholder="Provide the requested information…" value={reply} onChange={(e) => setReply(e.target.value)} /><button disabled={busy} onClick={respond} className={btnPrimary}>Send information</button></div>
      )}
      {queue && open && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <textarea rows={2} className={inp} placeholder="Verification note (required for Reject / Request info)…" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {c.status === 'Submitted' && <button disabled={busy} onClick={() => act('Under Review')} className={btnGhost}>Start review</button>}
            <button disabled={busy} onClick={() => act('More Information Required')} className={btnGhost}>Request info</button>
            <button disabled={busy} onClick={() => act('Approved')} className={btnOk}>Approve</button>
            <button disabled={busy} onClick={() => act('Rejected')} className={btnDanger}>Reject</button>
          </div>
        </div>
      )}
      <button onClick={() => setHist(!hist)} className="mt-3 text-xs text-indigo-600 underline">{hist ? 'Hide' : 'Show'} history</button>
      {hist && <div className="mt-2"><History type="claim" id={c.id} /></div>}
    </div>
  );
}
