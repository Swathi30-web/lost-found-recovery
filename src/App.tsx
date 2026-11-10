import { Navigate, Route, Routes } from 'react-router-dom';
import { Protected } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ItemList from './pages/ItemList';
import { FoundForm, LostForm } from './pages/Forms';
import ItemDetails from './pages/ItemDetails';
import Search from './pages/Search';
import Claims from './pages/Claims';
import Handovers from './pages/Handovers';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';

const S = ['staff', 'admin'] as const;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="lost" element={<ItemList kind="lost" />} />
        <Route path="lost/new" element={<LostForm />} />
        <Route path="lost/:id" element={<ItemDetails kind="lost" />} />
        <Route path="lost/:id/edit" element={<LostForm />} />
        <Route path="found" element={<ItemList kind="found" />} />
        <Route path="found/new" element={<FoundForm />} />
        <Route path="found/:id" element={<ItemDetails kind="found" />} />
        <Route path="found/:id/edit" element={<Protected roles={[...S]}><FoundForm /></Protected>} />
        <Route path="search" element={<Search />} />
        <Route path="claims" element={<Claims />} />
        <Route path="queue" element={<Protected roles={[...S]}><Claims queue /></Protected>} />
        <Route path="handovers" element={<Protected roles={[...S]}><Handovers /></Protected>} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
