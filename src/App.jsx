import { Fragment } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./providers/AuthContext.jsx";
import { useTheme } from "./providers/ThemeContext.jsx";
import Login from "./pages/Login.jsx";
import DataPage from "./pages/Data.jsx";
import VisualizePage from "./pages/Visualize.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import NotFound from "./pages/NotFound.jsx";
import ChatBot from "./ui/ChatBot.jsx";
import logoImage from "./LOGO.jpg";

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
    <div className={`min-h-screen flex flex-col transition-colors w-full ${location.pathname === '/login' ? 'bg-slate-950' : 'bg-slate-100 dark:bg-slate-900'}`}>
      <header className={`relative z-40 w-full transition-colors ${location.pathname === '/login' ? 'bg-transparent shadow-none' : 'bg-gradient-to-b from-white/95 via-white/90 to-transparent shadow-md dark:from-slate-900/90 dark:via-slate-900/95 dark:to-transparent'}`}>
        <div className="w-full flex items-center justify-between px-5 py-5">
          <Link to={user ? "/dashboard" : "/login"} className="flex items-center gap-2">
            <div className={`flex h-40 w-40 items-center justify-center overflow-hidden rounded-3xl border-2 shadow-xl ${location.pathname === '/login' ? 'border-white/40 bg-white/20 shadow-white/20' : 'border-white/80 bg-white/60 shadow-brand-900/30 dark:border-slate-200/60 dark:bg-slate-800/60'}`}>
              <img src={logoImage} alt="Datanaut logo" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className={`text-3xl font-semibold ${location.pathname === '/login' ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>DATANAUT</p>
              <p className={`text-lg ${location.pathname === '/login' ? 'text-slate-200' : 'text-slate-500 dark:text-slate-300'}`}>Data &gt; Charts &gt; Insights</p>
            </div>
          </Link>
          {user ? (
            <nav className="flex items-center gap-6 text-lg">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-full px-4 py-2 font-medium transition ${
                    location.pathname.startsWith(link.to)
                      ? "bg-brand-100 text-brand-800 dark:bg-brand-200/20 dark:text-brand-100"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-4 pl-4 text-base">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <span className="hidden text-lg text-slate-500 dark:text-slate-300 sm:inline-block">{user.email}</span>
                <button
                  onClick={logout}
                  className="rounded-full border border-slate-200 px-5 py-2 text-base font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
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
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${location.pathname === '/login' ? 'border border-white/40 text-white hover:bg-white/20' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'}`}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <Link
                to="/login"
                className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${location.pathname === '/login' ? 'bg-white/20 text-white border border-white/40 hover:bg-white/30' : 'bg-brand-500 text-white hover:bg-brand-600'}`}
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </header>
      <main className="w-full px-4 py-6 text-slate-800 transition-colors dark:text-slate-100 flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
      
      {/* Footer for all pages */}
      <footer className="w-full py-4 text-center border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>&copy; 2025 DATANAUT. All rights reserved.</p>
          <p className="mt-1">Developed by the DATANAUT Team</p>
        </div>
      </footer>
      
      {/* ChatBot for authenticated users */}
      {user && <ChatBot />}
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
