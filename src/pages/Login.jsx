import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (values) => {
    setAuthError("");
    try {
      await Promise.resolve(login(values.email, values.password));
      const redirect = location.state?.from?.pathname || "/dashboard";
      navigate(redirect, { replace: true });
    } catch (error) {
      setAuthError(error.message || "Login failed");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-16">
      <div className="pointer-events-none absolute inset-0 animate-gradient-slow bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.25),transparent_60%)]" />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6 rounded-3xl border border-white/20 bg-white/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-[0_20px_60px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-900/80">
        <div className="space-y-2 text-center sm:text-left">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
            Use any email/password - mock login
          </span>
          <h1 className="text-3xl font-semibold text-slate-900 transition duration-300 ease-out dark:text-slate-100">Welcome back</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Sign in to access your dashboards, saved datasets, and chart library.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="group relative flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:-translate-y-0.5 focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] focus:outline-none dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
              {...register("email", {
                required: "Email is required.",
                pattern: { value: /\S+@\S+\.\S+/, message: "Enter a valid email address." }
              })}
            />
            {errors.email ? <span className="text-xs text-red-500 dark:text-red-300">{errors.email.message}</span> : <span className="text-xs text-slate-400">We&apos;ll remember this locally.</span>}
          </label>

          <label className="group relative flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              placeholder="********"
              className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:-translate-y-0.5 focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] focus:outline-none dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
              {...register("password", {
                required: "Password is required.",
                minLength: { value: 4, message: "Password should be at least 4 characters." }
              })}
            />
            {errors.password ? <span className="text-xs text-red-500 dark:text-red-300">{errors.password.message}</span> : <span className="text-xs text-slate-400">Hint: any non-empty password works.</span>}
          </label>

          {authError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {authError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                Signing in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Authentication is stored in your browser only. Refresh to stay signed in; log out anytime from the top-right menu.
        </p>
      </div>
    </div>
  );
}
