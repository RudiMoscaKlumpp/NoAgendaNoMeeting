import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"latte" | "mocha">(() =>
    document.documentElement.classList.contains("mocha") ? "mocha" : "latte"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("mocha", theme === "mocha");
    localStorage.setItem("nanm-theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "latte" ? "mocha" : "latte")}
      className="text-xs font-black text-subtext-0 uppercase tracking-widest hover:text-sapphire transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "latte" ? "Dark" : "Light"}
    </button>
  );
}
