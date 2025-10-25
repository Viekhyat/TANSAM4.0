import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthContext.jsx";
import { DEMO_MODE } from "../firebase.js";

export default function Login() {
  const { login, signup, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(DEMO_MODE);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // Check if we're in demo mode
    setIsDemoMode(DEMO_MODE);
  }, []);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (values) => {
    setAuthError("");
    setStatusMessage("");
    try {
      if (isRegister) {
        await signup(values.email, values.password);
        try {
          await logout();
        } catch (logoutError) {
          console.warn("Logout after signup failed:", logoutError);
        }
        setIsRegister(false);
        reset({ email: values.email, password: "" });
        setStatusMessage("Account created successfully. Please sign in with your new credentials.");
        return;
      } else {
        await login(values.email, values.password);
      }
      const redirect = location.state?.from?.pathname || "/dashboard";
      navigate(redirect, { replace: true });
    } catch (error) {
      setAuthError(error?.message || "Authentication failed");
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");
    setStatusMessage("");
    try {
      await loginWithGoogle();
      const redirect = location.state?.from?.pathname || "/dashboard";
      navigate(redirect, { replace: true });
    } catch (error) {
      setAuthError(error?.message || "Google sign-in failed");
    }
  };

  return (
    <div className="login-container relative flex h-screen items-start justify-center overflow-hidden bg-slate-950 px-4 pt-8 pb-8">
      <div className="pointer-events-none absolute inset-0 animate-gradient-slow bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_bottom,_rgba(99,102,241,0.25),transparent_60%)]" />
      <div className="login-form relative z-10 flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-white/20 bg-white/80 p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-[0_20px_60px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-900/80 sm:max-w-sm sm:gap-3 sm:p-4 md:max-w-md md:gap-4 md:p-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
            {isDemoMode ? "Demo Mode - No Firebase required" : "Real authentication via Firebase"}
          </span>
          <h1 className="text-xl font-semibold text-slate-900 transition duration-300 ease-out dark:text-slate-100 sm:text-2xl md:text-3xl">
            {isRegister ? "Create account" : "Welcome back"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {isDemoMode ? (
              isRegister 
                ? "Demo mode: Create a demo account to explore the dashboard features."
                : "Demo mode: Sign in with any email/password or continue with Google to explore the dashboard."
            ) : (
              isRegister
                ? "Create an account with email or use Google to save your dashboards and datasets."
                : "Sign in with your email or Google account to access your dashboards, saved datasets, and chart library."
            )}
          </p>
        </div>

        <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="group relative flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:-translate-y-0.5 focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] focus:outline-none dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 sm:px-3 sm:py-2 md:px-4 md:py-3"
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
              className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:-translate-y-0.5 focus:border-brand-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] focus:outline-none dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 sm:px-3 sm:py-2 md:px-4 md:py-3"
              {...register("password", {
                required: "Password is required.",
                minLength: { value: 6, message: "Password should be at least 6 characters." }
              })}
            />
            {errors.password ? <span className="text-xs text-red-500 dark:text-red-300">{errors.password.message}</span> : <span className="text-xs text-slate-400">Hint: choose a secure password.</span>}
          </label>

          {authError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 shadow-sm dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {authError}
            </div>
          ) : null}

          {statusMessage ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
              {statusMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none sm:px-4 sm:py-2 md:px-5 md:py-3"
          >
            {isSubmitting ? (
              <>
                <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                {isRegister ? "Creating account..." : "Signing in..."}
              </>
            ) : isRegister ? (
              "Create account"
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span>or continue with</span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 sm:px-4 sm:py-2 md:px-5 md:py-3"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="h-5 w-5"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.68 1.22 9.16 3.6l6.87-6.87C35.66 2.65 30.2 0 24 0 14.7 0 6.59 5.38 2.56 13.22l7.99 6.2C12.65 13.22 17.86 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.5 24.5c0-1.65-.16-3.24-.46-4.79H24v9.06h12.7c-.55 2.83-2.23 5.24-4.75 6.88l7.45 5.78C43.4 37.89 46.5 31.68 46.5 24.5z"
            />
            <path
              fill="#FBBC05"
              d="M10.55 28.27c-.48-1.43-.75-2.96-.75-4.52s.27-3.09.75-4.52l-7.99-6.2C.84 17.18 0 20.5 0 23.75 0 27 0.84 30.32 2.56 33.22l7.99-6.2z"
            />
            <path
              fill="#34A853"
              d="M24 47.5c6.2 0 11.43-2.04 15.24-5.54l-7.45-5.78c-2.07 1.38-4.71 2.19-7.79 2.19-6.14 0-11.35-3.72-13.45-9.02l-7.99 6.2C6.59 42.62 14.7 47.5 24 47.5z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center justify-center">
          <button
            onClick={() => setIsRegister((s) => !s)}
            className="text-sm text-brand-600 hover:underline"
            type="button"
          >
            {isRegister ? "Have an account? Sign in" : "Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}
