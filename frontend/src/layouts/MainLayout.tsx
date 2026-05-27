import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* TODO: add Sidebar / Topbar */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
