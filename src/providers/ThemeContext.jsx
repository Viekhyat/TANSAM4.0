import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {}
});

const STORAGE_KEY = "tansam-theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const matcher = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    matcher.addEventListener("change", handler);
    return () => matcher.removeEventListener("change", handler);
  }, []);

  const setTheme = (next) => {
    setThemeState(next === "dark" ? "dark" : "light");
  };

  const toggleTheme = () => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
