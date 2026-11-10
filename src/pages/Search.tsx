import { useState } from 'react';
import { useAuth } from '../auth';
import MatchPanel from '../components/MatchPanel';
import { PageHeader } from '../components/ui';
import ItemList from './ItemList';

export default function Search() {
  const { user } = useAuth();
  const staff = user!.role !== 'user';
  const [kind, setKind] = useState<'found' | 'lost'>('found');
  const tab = (k: 'found' | 'lost', label: string) => (
    <button onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300'}`}>{label}</button>
  );
  return (
    <>
      <PageHeader title="Search & Possible Matches" sub="Search by name, category, location and date. Confirm matches suggested by the system." />
      {staff && <div className="mb-3 flex gap-2">{tab('found', 'Found items')}{tab('lost', 'Lost reports')}</div>}
      <ItemList kind={staff ? kind : 'found'} embedded key={kind} />
      <h2 className="mb-3 mt-8 text-lg font-semibold">Possible matches</h2>
      <MatchPanel />
    </>
  );
}
