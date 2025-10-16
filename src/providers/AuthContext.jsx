import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const AUTH_KEY = "auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email) {
          setUser(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to read auth from localStorage", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (email, password) => {
    if (!email?.trim() || !password?.trim()) {
      throw new Error("Email and password are required.");
    }
    const payload = { email: email.trim() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    setUser(payload);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout, loading }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
