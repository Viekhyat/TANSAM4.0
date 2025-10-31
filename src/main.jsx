import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

import { AuthProvider } from "./providers/AuthContext.jsx";
import { StoreProvider } from "./providers/StoreContext.jsx";
import { ThemeProvider } from "./providers/ThemeContext.jsx";

// ✅ Simple ErrorBoundary to prevent blank screen on render crash
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error("💥 Unhandled error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-700">
            ⚠️ Something went wrong
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            The application encountered an unexpected error. Try reloading.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-slate-100 p-3 text-xs text-red-600 text-left">
            {this.state.error?.message || "Unknown Error"}
            {this.state.info?.componentStack
              ? `\n\n${this.state.info.componentStack}`
              : ""}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ✅ Global error handlers (non-React)
if (typeof window !== "undefined") {
  window.addEventListener("error", (evt) => {
    console.error("🌐 Global error:", evt.error || evt.message, evt);
  });
  window.addEventListener("unhandledrejection", (evt) => {
    console.error("🌐 Unhandled promise rejection:", evt.reason);
  });
}

// ✅ Main App Mount
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
                <App />
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
