import logoDark from "@/assets/brain-logo-dark.png";
import logoLight from "@/assets/brain-logo-light.png";
import { useEffect, useState } from "react";

/** Returns the correct logo variant based on current theme (dark vs light). */
export function useThemeLogo() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark ? logoDark : logoLight;
}
