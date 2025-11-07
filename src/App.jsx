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
import DynamicDataPage from "./pages/DynamicData.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DynamicDashboard from "./pages/DynamicDashboard.jsx"; 
import DynamicVisualizePage from "./pages/DynamicVisualize.jsx";
import PresentationMode from "./ui/PresentationMode.jsx";
import PresentationWindow from "./ui/PresentationWindow.jsx";
import NotFound from "./pages/NotFound.jsx";
import ChatBot from "./ui/ChatBot.jsx";
import LiquidBackdrop from "./ui/LiquidBackdrop.jsx";
import { GlassHeader } from "./ui/GlassHeader.jsx";
import logoImage from "./LOGO.jpg";

// ✅ Centralized navigation
const navLinks = [
  { to: "/home", label: "Home" },
  { to: "/data", label: "Static Data" },
  { to: "/dashboard", label: "Static Dashboard" },
  { to: "/dynamic-data", label: "Dynamic Data" },
  { to: "/dynamic-dashboard", label: "Dynamic Dashboard" },
  { to: "/presentation", label: "Presentation" },
];

// Navigation routes for visualization pages
const visualizationRoutes = [
  //{ to: "/dynamic-visualize", label: "Dynamic Visualize" },
  //{ to: "/visualize", label: "Visualize" }
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
      <LiquidBackdrop />
      {/* ====== Header ====== */}
      <header className="relative z-40 w-full px-4 py-4">
        <GlassHeader className="flex flex-wrap items-center justify-between gap-4">
          {/* === Logo + Brand === */}
          <Link
            to={user ? "/dashboard" : "/login"}
            className="flex items-center gap-3"
          >
            <div
              className={`glass-solid flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl shadow-lg md:h-28 md:w-28 ${
                isLoginPage
                  ? "border border-white/40 shadow-white/20"
                  : "border border-white/60 shadow-brand-900/20 dark:border-slate-200/40 dark:shadow-brand-900/30"
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
                className={`text-2xl font-semibold md:text-3xl ${
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
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Data ➤ Charts ➤ Insights
              </p>
            </div>
          </Link>

          {/* === Navigation === */}
          {user ? (
            <nav className="flex flex-wrap items-center gap-3 text-base">
              {[...navLinks, ...visualizationRoutes].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`glass-hover rounded-full border px-4 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-900 ${
                    location.pathname.startsWith(link.to)
                      ? "border-white/30 bg-white/30 text-blue-900 shadow-sm shadow-brand-900/10 dark:border-white/20 dark:bg-white/10 dark:text-blue-100"
                      : "border-transparent text-slate-600 hover:bg-white/10 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {/* === Theme + User Controls === */}
              <div className="flex items-center gap-3 pl-1 text-sm md:text-base">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="glass-hover rounded-full border border-white/20 px-5 py-2 font-semibold text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
                >
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <span className="hidden text-lg text-slate-500 dark:text-slate-300 lg:inline-block">
                  {user.email}
                </span>
                <button
                  onClick={logout}
                  className="glass-hover rounded-full border border-white/20 px-5 py-2 font-medium text-slate-600 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:border-slate-200/20 dark:text-slate-200 dark:hover:bg-white/5 dark:focus-visible:ring-offset-slate-900"
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
                className={`glass-hover rounded-full border px-4 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-900 ${
                  isLoginPage
                    ? "border-white/40 text-white hover:bg-white/10"
                    : "border-slate-200 text-slate-600 hover:bg-white/10 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-white/5"
                }`}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <Link
                to="/login"
                className={`glass-hover rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-900 ${
                  isLoginPage
                    ? "border border-white/40 bg-white/25 text-white hover:bg-white/30"
                    : "border border-transparent bg-brand-500 text-white hover:bg-brand-600"
                }`}
              >
                Login
              </Link>
            </div>
          )}
        </GlassHeader>
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

      {/* ====== ChatBot (for logged-in users only, excluding presentation routes) ====== */}
      {user && !location.pathname.startsWith('/presentation-window') && !location.pathname.startsWith('/presentation') && <ChatBot />}
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
      {/* Presentation Window Route - No Layout, No Auth Check (opened from authenticated session) */}
      <Route
        path="/presentation-window"
        element={<PresentationWindow />}
      />

      {/* Main Layout Routes */}
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
        <Route
          path="/dynamic-data"
          element={
            <PrivateRoute>
              <DynamicDataPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/dynamic-dashboard"
          element={
            <PrivateRoute>
              <DynamicDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dynamic-visualize/:id?"
          element={
            <PrivateRoute>
              <DynamicVisualizePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/presentation"
          element={
            <PrivateRoute>
              <PresentationMode />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
