import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../lib';
import { btnPrimary, Field, Flash, inp } from '../components/ui';

const DEMO = [['Admin', 'admin@lf.com', 'admin123'], ['Staff', 'staff@lf.com', 'staff123'], ['User', 'user@lf.com', 'user123']];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate(); const loc = useLocation();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.');
    if (!password) return setErr('Password is required.');
    setBusy(true); setErr('');
    try { await login(email, password); nav((loc.state as { from?: string })?.from || '/', { replace: true }); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-xl" noValidate>
        <div className="text-center"><div className="text-4xl">🔎</div><h1 className="text-2xl font-bold">Lost & Found Recovery</h1><p className="text-sm text-slate-500">Sign in to continue</p></div>
        <Flash err={err} />
        <Field label="Email"><input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label="Password"><input type="password" className={inp} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Signing in…' : 'Login'}</button>
        <div className="border-t pt-3 text-center text-xs text-slate-500">
          Demo accounts (click to fill):
          <div className="mt-2 flex justify-center gap-2">
            {DEMO.map(([l, e, p]) => <button type="button" key={l} onClick={() => { setEmail(e); setPassword(p); }} className="rounded border px-2 py-1 hover:bg-slate-50">{l}</button>)}
          </div>
        </div>
      </form>
    </div>
  );
}
