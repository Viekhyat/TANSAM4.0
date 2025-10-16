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
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl bg-white p-8 shadow-lg transition-colors dark:bg-slate-800/80">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Sign in with any email and password to continue.</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Email
          <input
            type="email"
            placeholder="you@example.com"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
            {...register("email", { required: "Email is required." })}
          />
          {errors.email ? <span className="text-xs text-red-500">{errors.email.message}</span> : null}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Password
          <input
            type="password"
            placeholder="********"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100"
            {...register("password", { required: "Password is required." })}
          />
          {errors.password ? <span className="text-xs text-red-500">{errors.password.message}</span> : null}
        </label>
        {authError ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/20 dark:text-red-200">{authError}</div> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-300"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>
      </form>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        This is a mock login. Credentials are stored locally in your browser&apos;s storage.
      </p>
    </div>
  );
}
