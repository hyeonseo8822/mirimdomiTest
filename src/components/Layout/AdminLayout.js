import { Outlet } from 'react-router-dom';
import AdminSidebar from '../Navigation/adminSidebar';
import './Layout.css';

function AdminLayout({ userInfo, onLogout }) {
  return (
    <div className="layout">
      <AdminSidebar userInfo={userInfo} onLogout={onLogout} />
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;


