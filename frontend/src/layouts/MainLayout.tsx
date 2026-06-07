import { Outlet } from "react-router-dom";

// Pages own their own chrome (Sidebar + TopBar) for tight control over scroll
// behaviour and breadcrumbs. MainLayout is just an auth gateway placeholder.
export default function MainLayout() {
  return <Outlet />;
}
