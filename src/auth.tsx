import { createContext, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get } from './lib';
import type { Role, User } from './types';

interface AuthCtx { user: User | null; login: (email: string, password: string) => Promise<void>; logout: () => void }
const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('lf_user') || 'null'); } catch { return null; }
  });
  const login = async (email: string, password: string) => {
    const r = await get<User[]>('/users', { email: email.trim().toLowerCase(), password });
    if (!r[0]) throw new Error('Invalid email or password.');
    if (r[0].active === false) throw new Error('This account has been deactivated.');
    localStorage.setItem('lf_user', JSON.stringify(r[0]));
    setUser(r[0]);
  };
  const logout = () => { localStorage.removeItem('lf_user'); setUser(null); };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

/** Protected route: requires login and (optionally) one of the given roles. */
export function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl bg-white p-8 text-center shadow">
        <h2 className="text-xl font-semibold text-red-600">Access denied</h2>
        <p className="mt-2 text-sm text-slate-600">Your role ({user.role}) cannot open this page.</p>
      </div>
    );
  return <>{children}</>;
}
