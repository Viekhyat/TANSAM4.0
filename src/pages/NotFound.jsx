import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center shadow-sm transition-colors dark:bg-slate-800/80">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-200">
        <span className="text-2xl font-semibold">404</span>
      </div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Page not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-300">
        The page you are looking for does not exist. Return to the dashboard or explore your datasets.
      </p>
      <div className="flex gap-3">
        <Link to="/dashboard" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600">
          Go to dashboard
        </Link>
        <Link
          to="/data"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          View datasets
        </Link>
      </div>
    </div>
  );
}
