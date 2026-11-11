import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { emptyFilters, filterItems, get, norm, useFetch, type Filters, fmt } from '../lib';
import { FOUND_STATUSES, LOST_STATUSES, type Category, type FoundItem, type LostReport } from '../types';
import { Badge, btnGhost, btnPrimary, card, catIcon, Empty, ErrorBox, FilterBar, ItemImage, PageHeader, Spinner } from '../components/ui';

type Item = LostReport | FoundItem;

/** Listing for lost reports (users see only their own) or found items. Reused by the Search page. */
export default function ItemList({ kind, embedded }: { kind: 'lost' | 'found'; embedded?: boolean }) {
  const { user } = useAuth();
  const staff = user!.role !== 'user';
  const [f, setF] = useState<Filters>(emptyFilters);
  const q = useFetch(async () => {
    const [items, cats] = await Promise.all([
      get<Item[]>(kind === 'lost' ? '/lostReports' : '/foundItems', kind === 'lost' && !staff ? { userId: user!.id } : undefined),
      get<Category[]>('/categories'),
    ]);
    return { items, cats };
  }, [kind]);

  const body = () => {
    if (q.loading) return <Spinner />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} onRetry={q.reload} />;
    const rows = filterItems(q.data.items, f, (x) => norm(kind, x));
    if (!rows.length)
      return <Empty text={q.data.items.length ? 'No items match your filters.' : `No ${kind} items yet.`} action={!q.data.items.length && !embedded && <Link className={btnPrimary} to={`/${kind}/new`}>Create one</Link>} />;
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((i) => {
          const n = norm(kind, i);
          const cat = q.data!.cats.find((c) => c.id === n.cat);
          return (
            <div key={i.id} className={`${card} flex flex-col`}>
              <ItemImage src={i.image} alt={n.name} icon={catIcon(cat?.name)} className="mb-3 aspect-[2/1] w-full rounded-lg object-cover" />
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{n.name}</h3><Badge s={n.status} /></div>
              <p className="text-xs text-slate-500">{cat?.name}</p>
              <p className="mt-2 text-sm text-slate-600">📍 {n.loc}<br />📅 {fmt(n.date)}</p>
              <div className="mt-3 flex gap-2 pt-1">
                <Link to={`/${kind}/${i.id}`} className={btnGhost}>View</Link>
                {(kind === 'lost' || staff) && <Link to={`/${kind}/${i.id}/edit`} className={btnGhost}>Edit</Link>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const title = kind === 'lost' ? (staff ? 'Lost Reports' : 'My Lost Reports') : 'Found Items';
  return (
    <>
      {!embedded && <PageHeader title={title} actions={<Link to={`/${kind}/new`} className={btnPrimary}>{kind === 'lost' ? '+ Report lost item' : '+ Register found item'}</Link>} />}
      <FilterBar f={f} set={setF} cats={q.data?.cats ?? []} statuses={kind === 'lost' ? LOST_STATUSES : FOUND_STATUSES} statusLabel="Status" />
      {body()}
    </>
  );
}
