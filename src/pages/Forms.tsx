import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg, generateMatches, get, logActivity, now, patch, post, today, useFetch } from '../lib';
import { FOUND_STATUSES, type Category, type FoundItem, type LostReport } from '../types';
import { btnGhost, btnPrimary, ErrorBox, Field, Flash, ImageInput, inp, PageHeader, Spinner, card } from '../components/ui';

type Errs = Record<string, string>;
const dateErr = (d: string) => (!d ? 'Date is required.' : d > today() ? 'Date cannot be in the future.' : Number.isNaN(Date.parse(d)) ? 'Invalid date.' : '');

const CatSelect = ({ cats, v, on, err }: { cats: Category[]; v: string; on: (v: string) => void; err?: string }) => (
  <Field label="Category *" error={err}>
    <select className={inp} value={v} onChange={(e) => on(e.target.value)}><option value="">Select…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
  </Field>
);

export function LostForm() {
  const { id } = useParams(); const { user } = useAuth(); const nav = useNavigate();
  const [v, setV] = useState({ itemName: '', categoryId: '', description: '', lastSeenLocation: '', lastSeenDate: '', identifyingDetails: '', contactPreference: 'Email', image: '' });
  const [errs, setErrs] = useState<Errs>({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const cats = useFetch(() => get<Category[]>('/categories'));
  const ex = useFetch(async () => (id ? get<LostReport>(`/lostReports/${id}`) : null), [id]);
  useEffect(() => { if (ex.data) setV({ ...ex.data, categoryId: String(ex.data.categoryId), image: ex.data.image || '' }); }, [ex.data]);
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const text = (k: keyof typeof v) => ({ className: inp, value: v[k], onChange: (e: { target: { value: string } }) => set(k)(e.target.value) });

  if (cats.loading || ex.loading) return <Spinner />;
  if (cats.error || ex.error) return <ErrorBox msg={cats.error || ex.error} />;
  if (ex.data && user!.role === 'user' && ex.data.userId !== user!.id) return <ErrorBox msg="You can only edit your own reports." />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Errs = {};
    if (v.itemName.trim().length < 3) x.itemName = 'Item name is required (min 3 characters).';
    if (!v.categoryId) x.categoryId = 'Select a category.';
    if (v.description.trim().length < 10) x.description = 'Describe the item (min 10 characters).';
    if (!v.lastSeenLocation.trim()) x.lastSeenLocation = 'Last-seen location is required.';
    if (dateErr(v.lastSeenDate)) x.lastSeenDate = dateErr(v.lastSeenDate);
    if (v.identifyingDetails.trim().length < 5) x.identifyingDetails = 'Add identifying details (min 5 characters).';
    setErrs(x); setApiErr('');
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const body = { ...v, itemName: v.itemName.trim(), categoryId: Number(v.categoryId) };
      if (ex.data) {
        await patch(`/lostReports/${ex.data.id}`, body);
        await logActivity('lost', ex.data.id, 'Report edited', user!.id);
        nav(`/lost/${ex.data.id}`);
      } else {
        const mine = await get<LostReport[]>('/lostReports', { userId: user!.id });
        if (mine.some((r) => r.itemName.trim().toLowerCase() === body.itemName.toLowerCase() && r.lastSeenDate === v.lastSeenDate))
          throw new Error('Duplicate: you already reported this item for the same date.');
        const created = await post<LostReport>('/lostReports', { ...body, userId: user!.id, status: 'Open', createdAt: now() });
        await logActivity('lost', created.id, 'Report created', user!.id);
        await generateMatches('lost', created);
        nav(`/lost/${created.id}`);
      }
    } catch (x2) { setApiErr(errMsg(x2)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={ex.data ? 'Edit Lost Report' : 'Report Lost Item'} />
      <form onSubmit={submit} noValidate className={`${card} grid max-w-3xl gap-4 sm:grid-cols-2`}>
        <div className="sm:col-span-2"><Flash err={apiErr} /></div>
        <Field label="Item name *" error={errs.itemName}><input {...text('itemName')} /></Field>
        <CatSelect cats={cats.data!} v={v.categoryId} on={set('categoryId')} err={errs.categoryId} />
        <div className="sm:col-span-2"><Field label="Description *" error={errs.description}><textarea rows={3} {...text('description')} /></Field></div>
        <Field label="Last seen location *" error={errs.lastSeenLocation}><input {...text('lastSeenLocation')} /></Field>
        <Field label="Last seen date *" error={errs.lastSeenDate}><input type="date" max={today()} {...text('lastSeenDate')} /></Field>
        <div className="sm:col-span-2"><Field label="Identifying details * (marks, serial no., contents)" error={errs.identifyingDetails}><textarea rows={2} {...text('identifyingDetails')} /></Field></div>
        <Field label="Contact preference">
          <select className={inp} value={v.contactPreference} onChange={(e) => set('contactPreference')(e.target.value)}><option>Email</option><option>Phone</option><option>In-app</option></select>
        </Field>
        <ImageInput value={v.image} onChange={set('image')} />
        <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save report'}</button><Link to="/lost" className={btnGhost}>Cancel</Link></div>
      </form>
    </>
  );
}

export function FoundForm() {
  const { id } = useParams(); const { user } = useAuth(); const nav = useNavigate();
  const staff = user!.role !== 'user';
  const [v, setV] = useState({ itemName: '', categoryId: '', description: '', foundLocation: '', foundDate: '', storageLocation: '', status: 'In Storage', image: '' });
  const [errs, setErrs] = useState<Errs>({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const cats = useFetch(() => get<Category[]>('/categories'));
  const ex = useFetch(async () => (id ? get<FoundItem>(`/foundItems/${id}`) : null), [id]);
  useEffect(() => { if (ex.data) setV({ ...ex.data, categoryId: String(ex.data.categoryId), image: ex.data.image || '' }); }, [ex.data]);
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const text = (k: keyof typeof v) => ({ className: inp, value: v[k], onChange: (e: { target: { value: string } }) => set(k)(e.target.value) });

  if (cats.loading || ex.loading) return <Spinner />;
  if (cats.error || ex.error) return <ErrorBox msg={cats.error || ex.error} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Errs = {};
    if (v.itemName.trim().length < 3) x.itemName = 'Item name is required (min 3 characters).';
    if (!v.categoryId) x.categoryId = 'Select a category.';
    if (v.description.trim().length < 10) x.description = 'Describe the item (min 10 characters).';
    if (!v.foundLocation.trim()) x.foundLocation = 'Found location is required.';
    if (dateErr(v.foundDate)) x.foundDate = dateErr(v.foundDate);
    if (!v.storageLocation.trim()) x.storageLocation = 'Say where the item is stored now.';
    setErrs(x); setApiErr('');
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const body = { ...v, itemName: v.itemName.trim(), categoryId: Number(v.categoryId) };
      if (ex.data) {
        await patch(`/foundItems/${ex.data.id}`, body);
        await logActivity('found', ex.data.id, 'Item edited', user!.id);
        nav(`/found/${ex.data.id}`);
      } else {
        const all = await get<FoundItem[]>('/foundItems');
        if (all.some((r) => r.itemName.trim().toLowerCase() === body.itemName.toLowerCase() && r.foundDate === v.foundDate && r.foundLocation.trim().toLowerCase() === v.foundLocation.trim().toLowerCase()))
          throw new Error('Duplicate: this found item is already registered for the same place and date.');
        const created = await post<FoundItem>('/foundItems', { ...body, status: 'In Storage', reporterId: user!.id, createdAt: now() });
        await logActivity('found', created.id, 'Found item registered', user!.id);
        await generateMatches('found', created);
        nav(`/found/${created.id}`);
      }
    } catch (x2) { setApiErr(errMsg(x2)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={ex.data ? 'Edit Found Item' : 'Register Found Item'} />
      <form onSubmit={submit} noValidate className={`${card} grid max-w-3xl gap-4 sm:grid-cols-2`}>
        <div className="sm:col-span-2"><Flash err={apiErr} /></div>
        <Field label="Item name *" error={errs.itemName}><input {...text('itemName')} /></Field>
        <CatSelect cats={cats.data!} v={v.categoryId} on={set('categoryId')} err={errs.categoryId} />
        <div className="sm:col-span-2"><Field label="Description *" error={errs.description}><textarea rows={3} {...text('description')} /></Field></div>
        <Field label="Found location *" error={errs.foundLocation}><input {...text('foundLocation')} /></Field>
        <Field label="Found date *" error={errs.foundDate}><input type="date" max={today()} {...text('foundDate')} /></Field>
        <Field label="Storage location *" error={errs.storageLocation}><input {...text('storageLocation')} /></Field>
        {staff && ex.data ? (
          <Field label="Current status"><select className={inp} value={v.status} onChange={(e) => set('status')(e.target.value)}>{FOUND_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        ) : <Field label="Current status"><input className={inp} value="In Storage" disabled /></Field>}
        <div className="sm:col-span-2"><ImageInput value={v.image} onChange={set('image')} /></div>
        <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save item'}</button><Link to="/found" className={btnGhost}>Cancel</Link></div>
      </form>
    </>
  );
}
