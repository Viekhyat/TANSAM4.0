import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { AuthProvider } from "./providers/AuthContext.jsx";
import { StoreProvider } from "./providers/StoreContext.jsx";
import { ThemeProvider } from "./providers/ThemeContext.jsx";

// Simple ErrorBoundary to avoid a blank page when unexpected render errors occur
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
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600">
            The application encountered an error. You can try reloading the page.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs text-red-600">
            {String(this.state.error && this.state.error.message) || "Error"}
            {this.state.info?.componentStack ? `\n\n${this.state.info.componentStack}` : ""}
          </pre>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-brand-500 px-4 py-2 text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global handlers to catch errors that escape React lifecycle (helps diagnose blank screens)
if (typeof window !== "undefined") {
  window.addEventListener("error", (evt) => {
    // keep logging minimal and visible
    // eslint-disable-next-line no-console
    console.error("Global error:", evt.error || evt.message, evt);
  });
  window.addEventListener("unhandledrejection", (evt) => {
    // eslint-disable-next-line no-console
    console.error("Unhandled promise rejection:", evt.reason);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <StoreProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </StoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
