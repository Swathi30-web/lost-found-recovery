import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { ACTIVE_CLAIM, fmt, get, useFetch } from '../lib';
import type { Activity, Claim, FoundItem, Handover, LostReport, Match, Notification, User } from '../types';
import { btnGhost, btnPrimary, card, ErrorBox, PageHeader, Spinner, Stat } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const staff = user!.role !== 'user';
  const q = useFetch(async () => {
    const [lost, found, claims, handovers, matches, notes, logs, users] = await Promise.all([
      get<LostReport[]>('/lostReports'), get<FoundItem[]>('/foundItems'), get<Claim[]>('/claims'), get<Handover[]>('/handovers'),
      get<Match[]>('/matchSuggestions'), get<Notification[]>('/notifications', { userId: user!.id, read: false }),
      get<Activity[]>('/activityLogs', { _sort: 'createdAt', _order: 'desc', _limit: 8 }), get<User[]>('/users'),
    ]);
    return { lost, found, claims, handovers, matches, notes, logs, users };
  });
  if (q.loading) return <Spinner />;
  if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
  const { lost, found, claims, handovers, matches, notes, logs, users } = q.data;

  if (!staff) {
    const myLost = lost.filter((l) => l.userId === user!.id), myClaims = claims.filter((c) => c.userId === user!.id);
    const myMatches = matches.filter((m) => m.status === 'Suggested' && myLost.some((l) => l.id === m.lostId));
    return (
      <>
        <PageHeader title={`Welcome, ${user!.name}`} sub="Track your reports and claims." actions={<><Link to="/lost/new" className={btnPrimary}>+ Report lost item</Link><Link to="/found/new" className={btnGhost}>Report found item</Link></>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="My lost reports" value={myLost.length} />
          <Stat label="Possible matches" value={myMatches.length} tone="purple" />
          <Stat label="My active claims" value={myClaims.filter((c) => ACTIVE_CLAIM.includes(c.status)).length} tone="amber" />
          <Stat label="Unread notifications" value={notes.length} tone="red" />
        </div>
      </>
    );
  }

  const open = claims.filter((c) => ACTIVE_CLAIM.includes(c.status)).length;
  const pending = claims.filter((c) => ['Submitted', 'Under Review'].includes(c.status)).length;
  return (
    <>
      <PageHeader title={user!.role === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard'} sub="Overview of the recovery pipeline." actions={<><Link to="/queue" className={btnPrimary}>Claim queue</Link><Link to="/handovers" className={btnGhost}>Handovers</Link></>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Total lost reports" value={lost.length} tone="blue" />
        <Stat label="Total found items" value={found.length} tone="emerald" />
        <Stat label="Open claims" value={open} tone="amber" />
        <Stat label="Pending verification" value={pending} tone="red" />
        <Stat label="Approved claims" value={claims.filter((c) => c.status === 'Approved').length} tone="indigo" />
        <Stat label="Completed handovers" value={handovers.filter((h) => ['Handed Over', 'Closed'].includes(h.status)).length} tone="purple" />
      </div>
      <h2 className="mb-2 mt-6 font-semibold">Recent activity</h2>
      <div className={card}>
        <ul className="divide-y text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span><b>{l.action}</b> <span className="text-slate-500">· {l.entityType} #{l.entityId} · {users.find((u) => u.id === l.actorId)?.name}</span></span>
              <span className="text-xs text-slate-400">{fmt(l.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
