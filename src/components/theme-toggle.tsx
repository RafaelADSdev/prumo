"use client";

import { Moon, Sun } from "lucide-react";
import { useRef, type MouseEvent } from "react";
import { applyTheme, readTheme } from "@/lib/theme";
import { canAnimate } from "@/lib/motion";

// Circular reveal adapted from RafaelADSdev/Plataforma-Video.
export function ThemeToggle() {
  const changing = useRef(false);

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    if (changing.current) return;
    const theme = readTheme() === "dark" ? "light" : "dark";
    if (!document.startViewTransition || !canAnimate() || event.detail === 0) {
      applyTheme(theme);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    );
    const root = document.documentElement;
    changing.current = true;
    root.classList.add("theme-changing");
    try {
      const transition = document.startViewTransition(() => applyTheme(theme));
      try {
        await transition.ready;
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 560,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      } catch {
        transition.skipTransition();
      }
      await transition.finished;
    } catch {
      applyTheme(theme);
    } finally {
      changing.current = false;
      root.classList.remove("theme-changing");
    }
  }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label="Alternar entre modo claro e escuro"
      title="Alternar entre modo claro e escuro"
      onClick={(event) => void toggle(event)}
    >
      <Moon className="theme-icon-moon" size={18} aria-hidden="true" />
      <Sun className="theme-icon-sun" size={18} aria-hidden="true" />
    </button>
  );
}
