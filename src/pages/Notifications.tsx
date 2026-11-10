import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { btnGhost, card, Empty, ErrorBox, Flash, PageHeader, Spinner } from '../components/ui';
import { errMsg, fmt, get, patch, useFetch } from '../lib';
import type { Notification } from '../types';

const ICON: Record<string, string> = { match: '🔗', claim: '📝', info: '❓', handover: '📦' };

export default function Notifications() {
  const { user } = useAuth();
  const [type, setType] = useState(''); const [err, setErr] = useState('');
  const q = useFetch(() => get<Notification[]>('/notifications', { userId: user!.id, _sort: 'createdAt', _order: 'desc' }));
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const rows = q.data.filter((n) => !type || n.type === type);
  const read = async (ns: Notification[]) => { try { await Promise.all(ns.filter((n) => !n.read).map((n) => patch(`/notifications/${n.id}`, { read: true }))); q.reload(); } catch (e) { setErr(errMsg(e)); } };

  return (
    <>
      <PageHeader title="Notifications" actions={<button onClick={() => read(q.data!)} className={btnGhost}>Mark all as read</button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        {['', 'match', 'claim', 'info', 'handover'].map((t) => (
          <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-xs font-medium ${type === t ? 'bg-indigo-600 text-white' : 'bg-white ring-1 ring-slate-300'}`}>{t || 'all'}</button>
        ))}
      </div>
      <Flash err={err} />
      {!rows.length ? <Empty text="You're all caught up." /> : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Link key={n.id} to={n.link} onClick={() => read([n])} className={`${card} flex items-start gap-3 hover:bg-slate-50 ${n.read ? 'opacity-70' : 'border-l-4 border-l-indigo-500'}`}>
              <span className="text-xl">{ICON[n.type]}</span>
              <div><p className="text-sm">{n.message}</p><p className="text-xs text-slate-400">{fmt(n.createdAt)}</p></div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
