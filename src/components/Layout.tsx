import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { get } from '../lib';
import type { Notification, Role } from '../types';

const NAV: Record<Role, [string, string][]> = {
  user: [['/', 'Dashboard'], ['/lost', 'My Lost Reports'], ['/found', 'Found Items'], ['/search', 'Search & Matches'], ['/claims', 'My Claims'], ['/notifications', 'Notifications']],
  staff: [['/', 'Dashboard'], ['/lost', 'Lost Reports'], ['/found', 'Found Items'], ['/search', 'Search & Matches'], ['/queue', 'Claim Queue'], ['/handovers', 'Handovers'], ['/notifications', 'Notifications']],
  admin: [['/', 'Dashboard'], ['/lost', 'Lost Reports'], ['/found', 'Found Items'], ['/search', 'Search & Matches'], ['/queue', 'Claim Queue'], ['/handovers', 'Handovers'], ['/admin', 'Admin & Reports'], ['/notifications', 'Notifications']],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [open, setOpen] = useState(false); const [unread, setUnread] = useState(0);
  useEffect(() => {
    setOpen(false);
    get<Notification[]>('/notifications', { userId: user!.id, read: false }).then((n) => setUnread(n.length)).catch(() => setUnread(0));
  }, [loc.pathname, user]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-indigo-700 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="rounded p-1 md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
            <span className="text-lg font-bold">🔎 Lost & Found</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{user!.name} <span className="rounded bg-indigo-900 px-2 py-0.5 text-xs uppercase">{user!.role}</span></span>
            <button onClick={() => { logout(); nav('/login'); }} className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">Logout</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <nav className={`${open ? 'block' : 'hidden'} fixed inset-x-0 top-14 z-10 bg-white p-3 shadow md:static md:block md:w-56 md:shrink-0 md:bg-transparent md:p-0 md:shadow-none`}>
          <ul className="space-y-1">
            {NAV[user!.role].map(([to, label]) => (
              <li key={to}>
                <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {label}{to === '/notifications' && unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs text-white">{unread}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
