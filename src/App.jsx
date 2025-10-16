import { Fragment } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./providers/AuthContext.jsx";
import { useTheme } from "./providers/ThemeContext.jsx";
import Login from "./pages/Login.jsx";
import DataPage from "./pages/Data.jsx";
import VisualizePage from "./pages/Visualize.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import NotFound from "./pages/NotFound.jsx";

const navLinks = [
  { to: "/data", label: "Data" },
  { to: "/visualize", label: "Visualize" },
  { to: "/dashboard", label: "Dashboard" }
];

function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-slate-100 transition-colors dark:bg-slate-900">
      <header className="bg-white shadow-sm transition-colors dark:bg-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to={user ? "/dashboard" : "/login"} className="flex items-center gap-2">
            <div className="rounded-md bg-brand-500 p-2 text-white">
              <span className="text-sm font-semibold">VD</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">VISUAL DASH</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">Data &gt; Charts &gt; Insights</p>
            </div>
          </Link>
          {user ? (
            <nav className="flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                    location.pathname.startsWith(link.to)
                      ? "bg-brand-100 text-brand-800 dark:bg-brand-200/20 dark:text-brand-100"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-3 pl-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <span className="hidden text-sm text-slate-500 dark:text-slate-300 sm:inline-block">{user.email}</span>
                <button
                  onClick={logout}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Logout
                </button>
              </div>
            </nav>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <Link
                to="/login"
                className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 text-slate-800 transition-colors dark:text-slate-100 min-h-[calc(100vh-120px)]">
        <Outlet />
      </main>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Fragment>{children}</Fragment>;
}

export default function App() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <Routes location={location} key={location.pathname}>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route
          path="/data"
          element={
            <PrivateRoute>
              <DataPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/visualize"
          element={
            <PrivateRoute>
              <VisualizePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
