"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "sevaai-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] =
    useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(
      STORAGE_KEY,
    ) as Theme | null;

    const initialTheme: Theme =
      storedTheme === "light" ||
      storedTheme === "dark" ||
      storedTheme === "system"
        ? storedTheme
        : "system";

    setThemeState(initialTheme);

    const mediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const updateTheme = () => {
      const resolved =
        initialTheme === "system"
          ? mediaQuery.matches
            ? "dark"
            : "light"
          : initialTheme;

      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    updateTheme();

    const handleSystemThemeChange = () => {
      if (initialTheme === "system") {
        updateTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleSystemThemeChange,
      );
    };
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);

    const resolved =
      nextTheme === "system" ? getSystemTheme() : nextTheme;

    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}