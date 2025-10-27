import { Fragment } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./providers/AuthContext.jsx";
import { useTheme } from "./providers/ThemeContext.jsx";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import DataPage from "./pages/Data.jsx";
import VisualizePage from "./pages/Visualize.jsx";
import DashboardPage from "./pages/Dashboard.jsx";import VisualizePage from "./pages/Visualize.jsx";
import DashboardPage from "./pages/Dashboard.jsx";

import Dashboard from "./pages/Dashboard.jsx"; // ✅ fixed import
import NotFound from "./pages/NotFound.jsx";
import ChatBot from "./ui/ChatBot.jsx";
import logoImage from "./LOGO.jpg";

// ✅ Centralized navigation
const navLinks = [
  { to: "/home", label: "Home" },
  { to: "/data", label: "Data" },
  { to: "/visualize", label: "Visualize" },
  { to: "/dashboard", label: "Dashboard" },
];

function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isLoginPage = location.pathname === "/login";

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors w-full ${
        isLoginPage ? "bg-slate-950" : "bg-slate-100 dark:bg-slate-900"
      }`}
    >
      {/* ====== Header ====== */}
      <header
        className={`relative z-40 w-full transition-colors ${
          isLoginPage
            ? "bg-transparent shadow-none"
            : "bg-gradient-to-b from-white/95 via-white/90 to-transparent shadow-md dark:from-slate-900/90 dark:via-slate-900/95 dark:to-transparent"
        }`}
      >
        <div className="w-full flex items-center justify-between px-5 py-5">
          {/* === Logo + Brand === */}
          <Link
            to={user ? "/dashboard" : "/login"}
            className="flex items-center gap-2"
          >
            <div
              className={`flex h-20 w-20 md:h-28 md:w-28 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-xl ${
                isLoginPage
                  ? "border-white/40 bg-white/20 shadow-white/20"
                  : "border-white/80 bg-white/60 shadow-brand-900/30 dark:border-slate-200/60 dark:bg-slate-800/60"
              }`}
            >
              <img
                src={logoImage}
                alt="Datanaut logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p
                className={`text-2xl md:text-3xl font-semibold ${
                  isLoginPage
                    ? "text-white"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                DATANAUT
              </p>
              <p
                className={`text-sm md:text-lg ${
                  isLoginPage
                    ? "text-slate-200"
                    : "text-slate-500 dark:text-slate-300"
                }`}
              >
                Data ➤ Charts ➤ Insights
              </p>
            </div>
          </Link>

          {/* === Navigation === */}
          {user ? (
            <nav className="flex items-center gap-6 text-lg">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`rounded-full px-4 py-2 font-medium transition ${
                    location.pathname.startsWith(link.to)
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-200/20 dark:text-blue-100"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* === Theme + User Controls === */}
              <div className="flex items-center gap-4 pl-4 text-base">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <span className="hidden text-lg text-slate-500 dark:text-slate-300 sm:inline-block">
                  {user.email}
                </span>
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
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  isLoginPage
                    ? "border border-white/40 text-white hover:bg-white/20"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <Link
                to="/login"
                className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition ${
                  isLoginPage
                    ? "bg-white/20 text-white border border-white/40 hover:bg-white/30"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ====== Main Content ====== */}
      <main className="w-full px-4 py-6 text-slate-800 transition-colors dark:text-slate-100 flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>

      {/* ====== Footer ====== */}
      <footer className="w-full py-4 text-center border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>&copy; 2025 DATANAUT. All rights reserved.</p>
          <p className="mt-1">Developed by the DATANAUT Team</p>
        </div>
      </footer>

      {/* ====== ChatBot (for logged-in users only) ====== */}
      {user && <ChatBot />}
    </div>
  );
}

// ✅ Protect private routes
function PrivateRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Fragment>{children}</Fragment>;
}

// ✅ Define all app routes
export default function App() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <Routes location={location} key={location.pathname}>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
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
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
