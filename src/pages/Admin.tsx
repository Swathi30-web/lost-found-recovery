import { useState, type FormEvent } from 'react';
import { Badge, btnDanger, btnGhost, btnPrimary, card, Empty, ErrorBox, Field, Flash, inp, PageHeader, Spinner } from '../components/ui';
import { del, errMsg, fmt, get, patch, post, useFetch } from '../lib';
import { CLAIM_STATUSES, FOUND_STATUSES, HANDOVER_STATUSES, LOST_STATUSES, type Category, type Claim, type FoundItem, type Handover, type LostReport, type Role, type User } from '../types';

export default function Admin() {
  const [tab, setTab] = useState<'reports' | 'users' | 'categories'>('reports');
  return (
    <>
      <PageHeader title="Admin & Reports" />
      <div className="mb-4 flex gap-2">
        {(['reports', 'users', 'categories'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-slate-300'}`}>{t}</button>
        ))}
      </div>
      {tab === 'reports' ? <Reports /> : tab === 'users' ? <Users /> : <Categories />}
    </>
  );
}

const Count = ({ title, list, rows }: { title: string; list: string[]; rows: Record<string, number> }) => (
  <div className={card}>
    <h3 className="mb-2 font-semibold">{title}</h3>
    <table className="w-full text-sm"><tbody>{list.map((s) => <tr key={s} className="border-t"><td className="py-1.5"><Badge s={s} /></td><td className="py-1.5 text-right font-semibold">{rows[s] ?? 0}</td></tr>)}</tbody></table>
  </div>
);
const tally = (xs: { status: string }[]) => xs.reduce<Record<string, number>>((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {});

function Reports() {
  const q = useFetch(async () => {
    const [lost, found, claims, hand, cats, users] = await Promise.all([get<LostReport[]>('/lostReports'), get<FoundItem[]>('/foundItems'), get<Claim[]>('/claims'), get<Handover[]>('/handovers'), get<Category[]>('/categories'), get<User[]>('/users')]);
    return { lost, found, claims, hand, cats, users };
  });
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { lost, found, claims, hand, cats, users } = q.data;
  const max = Math.max(1, ...cats.map((c) => lost.filter((l) => l.categoryId === c.id).length + found.filter((f) => f.categoryId === c.id).length));
  const history = hand.filter((h) => h.status !== 'Ready for Handover').sort((a, b) => (b.handoverDate ?? '').localeCompare(a.handoverDate ?? ''));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Count title={`Lost reports (${lost.length})`} list={[...LOST_STATUSES]} rows={tally(lost)} />
        <Count title={`Found items (${found.length})`} list={[...FOUND_STATUSES]} rows={tally(found)} />
        <Count title={`Claim status summary (${claims.length})`} list={[...CLAIM_STATUSES]} rows={tally(claims)} />
      </div>
      <div className={card}>
        <h3 className="mb-3 font-semibold">Category-wise report</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-slate-500"><th className="pb-2">Category</th><th>Lost</th><th>Found</th><th>Claims</th><th className="w-1/3">Volume</th></tr></thead>
          <tbody>{cats.map((c) => {
            const l = lost.filter((x) => x.categoryId === c.id).length, f = found.filter((x) => x.categoryId === c.id).length;
            const cl = claims.filter((x) => found.find((y) => y.id === x.foundId)?.categoryId === c.id).length;
            return <tr key={c.id} className="border-t"><td className="py-2">{c.name}</td><td>{l}</td><td>{f}</td><td>{cl}</td><td><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-indigo-500" style={{ width: `${((l + f) / max) * 100}%` }} /></div></td></tr>;
          })}</tbody>
        </table></div>
      </div>
      <Count title={`Handover status (${hand.length})`} list={[...HANDOVER_STATUSES]} rows={tally(hand)} />
      <div className={card}>
        <h3 className="mb-3 font-semibold">Handover history</h3>
        {!history.length ? <Empty text="No completed handovers yet." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-slate-500"><th className="pb-2">Item</th><th>Claimant</th><th>Date</th><th>Verifier</th><th>Status</th></tr></thead>
            <tbody>{history.map((h) => (
              <tr key={h.id} className="border-t"><td className="py-2">{found.find((f) => f.id === h.foundId)?.itemName}</td><td>{users.find((u) => u.id === h.userId)?.name}</td><td>{fmt(h.handoverDate)}</td><td>{users.find((u) => u.id === h.verifierId)?.name ?? '—'}</td><td><Badge s={h.status} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

function Users() {
  const q = useFetch(() => get<User[]>('/users'));
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'user' as Role });
  const [errs, setErrs] = useState<Record<string, string>>({}); const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (v.name.trim().length < 2) x.name = 'Name is required.';
    if (!/^\S+@\S+\.\S+$/.test(v.email)) x.email = 'Valid email required.';
    else if (q.data!.some((u) => u.email === v.email.trim().toLowerCase())) x.email = 'Email already exists.';
    if (v.password.length < 6) x.password = 'Min 6 characters.';
    setErrs(x); setOk(''); setErr('');
    if (Object.keys(x).length) return;
    try { await post('/users', { ...v, name: v.name.trim(), email: v.email.trim().toLowerCase(), active: true }); setV({ name: '', email: '', password: '', role: 'user' }); setOk('User added.'); q.reload(); } catch (e2) { setErr(errMsg(e2)); }
  };
  const update = async (u: User, body: Partial<User>) => { try { await patch(`/users/${u.id}`, body); setOk('User updated.'); q.reload(); } catch (e) { setErr(errMsg(e)); } };

  return (
    <div className="space-y-4">
      <Flash ok={ok} err={err} />
      <form onSubmit={add} noValidate className={`${card} grid gap-3 sm:grid-cols-5`}>
        <Field label="Name" error={errs.name}><input className={inp} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Email" error={errs.email}><input className={inp} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Password" error={errs.password}><input type="password" className={inp} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
        <Field label="Role"><select className={inp} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}><option value="user">User</option><option value="staff">Staff</option><option value="admin">Admin</option></select></Field>
        <div className="flex items-end"><button className={`${btnPrimary} w-full`}>Add user</button></div>
      </form>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-slate-500"><th className="pb-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>{q.data.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="py-2">{u.name}</td><td>{u.email}</td>
              <td><select aria-label="Role" className="rounded border px-1 py-0.5" value={u.role} onChange={(e) => update(u, { role: e.target.value as Role })}><option value="user">user</option><option value="staff">staff</option><option value="admin">admin</option></select></td>
              <td>{u.active === false ? <span className="text-red-600">Inactive</span> : <span className="text-emerald-600">Active</span>}</td>
              <td className="text-right"><button className={btnGhost} onClick={() => update(u, { active: u.active === false })}>{u.active === false ? 'Activate' : 'Deactivate'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Categories() {
  const q = useFetch(async () => ({ cats: await get<Category[]>('/categories'), lost: await get<LostReport[]>('/lostReports'), found: await get<FoundItem[]>('/foundItems') }));
  const [name, setName] = useState(''); const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { cats, lost, found } = q.data;
  const dup = (n: string, id = 0) => cats.some((c) => c.id !== id && c.name.toLowerCase() === n.trim().toLowerCase());

  const add = async (e: FormEvent) => {
    e.preventDefault(); setOk(''); setErr('');
    if (name.trim().length < 2) return setErr('Category name is required (min 2 characters).');
    if (dup(name)) return setErr('That category already exists.');
    try { await post('/categories', { name: name.trim() }); setName(''); setOk('Category added.'); q.reload(); } catch (e2) { setErr(errMsg(e2)); }
  };
  const rename = async (c: Category) => {
    const n = prompt('Rename category', c.name);
    if (n === null) return;
    if (n.trim().length < 2 || dup(n, c.id)) return setErr('Invalid or duplicate category name.');
    try { await patch(`/categories/${c.id}`, { name: n.trim() }); setOk('Category renamed.'); setErr(''); q.reload(); } catch (e) { setErr(errMsg(e)); }
  };
  const remove = async (c: Category) => {
    if (lost.some((l) => l.categoryId === c.id) || found.some((f) => f.categoryId === c.id)) return setErr('Category is in use and cannot be deleted.');
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await del(`/categories/${c.id}`); setOk('Category deleted.'); setErr(''); q.reload(); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <Flash ok={ok} err={err} />
      <form onSubmit={add} className={`${card} flex gap-3`}><input aria-label="New category" className={`${inp} mt-0`} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} /><button className={btnPrimary}>Add</button></form>
      <div className={card}>
        <ul className="divide-y">{cats.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span>{c.name} <span className="text-xs text-slate-400">({lost.filter((l) => l.categoryId === c.id).length + found.filter((f) => f.categoryId === c.id).length} items)</span></span>
            <span className="flex gap-2"><button className={btnGhost} onClick={() => rename(c)}>Rename</button><button className={btnDanger} onClick={() => remove(c)}>Delete</button></span>
          </li>
        ))}</ul>
      </div>
    </div>
  );
}
