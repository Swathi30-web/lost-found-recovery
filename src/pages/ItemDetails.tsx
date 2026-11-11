import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import MatchPanel from '../components/MatchPanel';
import { Badge, btnDanger, btnGhost, btnPrimary, btnOk, card, catIcon, ErrorBox, Field, Flash, History, inp, ItemImage, PageHeader, Spinner } from '../components/ui';
import { del, errMsg, fmt, get, logActivity, patch, submitClaim, useFetch } from '../lib';
import { FOUND_STATUSES, LOST_STATUSES, type Category, type Claim, type LostReport, type User } from '../types';

export default function ItemDetails({ kind }: { kind: 'lost' | 'found' }) {
  const { id } = useParams(); const { user } = useAuth(); const nav = useNavigate();
  const staff = user!.role !== 'user', admin = user!.role === 'admin';
  const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  const path = kind === 'lost' ? 'lostReports' : 'foundItems';
  const q = useFetch(async () => {
    const item = await get<any>(`/${path}/${id}`);
    const [cats, users, claims, myLost] = await Promise.all([
      get<Category[]>('/categories'), get<User[]>('/users'),
      kind === 'found' ? get<Claim[]>('/claims', { foundId: id }) : Promise.resolve([] as Claim[]),
      get<LostReport[]>('/lostReports', { userId: user!.id }),
    ]);
    return { item, cats, users, claims, myLost };
  }, [kind, id]);

  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error || 'Not found'} onRetry={q.reload} />;
  const { item, cats, users, claims, myLost } = q.data;
  const ownerId: number = kind === 'lost' ? item.userId : item.reporterId;
  if (kind === 'lost' && !staff && ownerId !== user!.id) return <ErrorBox msg="You do not have access to this report." />;

  const date = kind === 'lost' ? item.lastSeenDate : item.foundDate;
  const place = kind === 'lost' ? item.lastSeenLocation : item.foundLocation;
  const canEdit = staff || (kind === 'lost' && ownerId === user!.id);
  const myClaim = claims.find((c) => c.userId === user!.id && c.status !== 'Rejected');
  const canClaim = !staff && kind === 'found' && ownerId !== user!.id && ['In Storage', 'Claim Pending'].includes(item.status);

  const setStatus = async (s: string) => {
    setErr(''); setOk('');
    try { await patch(`/${path}/${id}`, { status: s }); await logActivity(kind, item.id, `Status changed to ${s}`, user!.id); setOk('Status updated.'); q.reload(); } catch (e) { setErr(errMsg(e)); }
  };
  const remove = async () => {
    if (!confirm('Delete permanently?')) return;
    if (claims.length) return setErr('Cannot delete an item that has claims.');
    try { await del(`/${path}/${id}`); nav(`/${kind}`); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <>
      <PageHeader title={item.itemName} sub={`${kind === 'lost' ? 'Lost report' : 'Found item'} #${item.id}`}
        actions={<>{canEdit && <Link to={`/${kind}/${id}/edit`} className={btnGhost}>Edit</Link>}{admin && <button onClick={remove} className={btnDanger}>Delete</button>}</>} />
      <div className="mb-4"><Flash ok={ok} err={err} /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <ItemImage src={item.image} alt={item.itemName} icon={catIcon(cats.find((c) => c.id === item.categoryId)?.name)} iconClass="text-6xl" className="mb-4 aspect-[2/1] w-full max-w-lg rounded-lg bg-slate-100 object-contain" />
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Status</dt><dd><Badge s={item.status} /></dd></div>
            <div><dt className="text-slate-500">Category</dt><dd>{cats.find((c) => c.id === item.categoryId)?.name}</dd></div>
            <div><dt className="text-slate-500">{kind === 'lost' ? 'Last seen location' : 'Found location'}</dt><dd>{place}</dd></div>
            <div><dt className="text-slate-500">{kind === 'lost' ? 'Last seen date' : 'Found date'}</dt><dd>{fmt(date)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Description</dt><dd>{item.description}</dd></div>
            {kind === 'lost' && <>
              <div className="sm:col-span-2"><dt className="text-slate-500">Identifying details</dt><dd>{item.identifyingDetails}</dd></div>
              <div><dt className="text-slate-500">Contact preference</dt><dd>{item.contactPreference}</dd></div>
            </>}
            {kind === 'found' && staff && <div><dt className="text-slate-500">Storage location</dt><dd>{item.storageLocation}</dd></div>}
            {staff && <div><dt className="text-slate-500">{kind === 'lost' ? 'Reported by' : 'Registered by'}</dt><dd>{users.find((u) => u.id === ownerId)?.name}</dd></div>}
            <div><dt className="text-slate-500">Created</dt><dd>{fmt(item.createdAt)}</dd></div>
          </dl>
          {canEdit && (
            <div className="mt-4 border-t pt-4">
              <Field label="Manage status">
                <select className={`${inp} max-w-xs`} value={item.status} onChange={(e) => setStatus(e.target.value)}>
                  {(kind === 'lost' ? LOST_STATUSES : FOUND_STATUSES).map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <div className={card}><h2 className="mb-3 font-semibold">Activity history</h2><History type={kind} id={item.id} /></div>
      </div>

      {kind === 'found' && (
        <div className="mt-6 space-y-4">
          {canClaim && (myClaim
            ? <div className={card}>You already have a claim for this item (<Badge s={myClaim.status} />). <Link to="/claims" className="text-indigo-600 underline">Track it</Link>.</div>
            : <ClaimForm foundId={item.id} myLost={myLost.filter((l) => ['Open', 'Matched'].includes(l.status))} onDone={() => { setOk('Claim submitted. Track it under My Claims.'); q.reload(); }} />)}
          {staff && <div className={card}>Claims on this item: <b>{claims.length}</b> <Link to="/queue" className="ml-2 text-indigo-600 underline">Open claim queue</Link></div>}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Possible matches</h2>
      <MatchPanel lostId={kind === 'lost' ? item.id : undefined} foundId={kind === 'found' ? item.id : undefined} />
    </>
  );
}

function ClaimForm({ foundId, myLost, onDone }: { foundId: number; myLost: LostReport[]; onDone: () => void }) {
  const { user } = useAuth();
  const [v, setV] = useState({ lostId: '', identifyingDetails: '', proofNotes: '' });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [apiErr, setApiErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (v.identifyingDetails.trim().length < 10) x.identifyingDetails = 'Describe identifying details only the owner would know (min 10 characters).';
    if (v.proofNotes.trim().length < 10) x.proofNotes = 'Add proof notes, e.g. receipts, photos, serial numbers (min 10 characters).';
    setErrs(x); setApiErr('');
    if (Object.keys(x).length) return;
    setBusy(true);
    try { await submitClaim({ foundId, lostId: v.lostId ? Number(v.lostId) : null, identifyingDetails: v.identifyingDetails.trim(), proofNotes: v.proofNotes.trim() }, user!); onDone(); }
    catch (e2) { setApiErr(errMsg(e2)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className={`${card} space-y-3`}>
      <h2 className="font-semibold">Is this yours? Submit an ownership claim</h2>
      <Flash err={apiErr} />
      <Field label="Linked lost report (optional)">
        <select className={inp} value={v.lostId} onChange={(e) => setV({ ...v, lostId: e.target.value })}><option value="">None</option>{myLost.map((l) => <option key={l.id} value={l.id}>{l.itemName}</option>)}</select>
      </Field>
      <Field label="Identifying details *" error={errs.identifyingDetails}><textarea rows={2} className={inp} value={v.identifyingDetails} onChange={(e) => setV({ ...v, identifyingDetails: e.target.value })} /></Field>
      <Field label="Proof notes *" error={errs.proofNotes}><textarea rows={2} className={inp} value={v.proofNotes} onChange={(e) => setV({ ...v, proofNotes: e.target.value })} /></Field>
      <button disabled={busy} className={btnPrimary}>{busy ? 'Submitting…' : 'Submit claim'}</button>
    </form>
  );
}
