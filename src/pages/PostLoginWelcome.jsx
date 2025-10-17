import { useNavigate } from "react-router-dom";

export default function PostLoginWelcome() {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-16">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 animate-gradient-slow bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.25),transparent_60%)]" />

      {/* Welcome card */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-[0_20px_60px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-900/80">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold text-slate-900 transition duration-300 ease-out dark:text-slate-100">
            Welcome to TANSAM
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Meet your data assistant! Feel free to explore your datasets and charts.
          </p>
          <button
            onClick={handleContinue}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
