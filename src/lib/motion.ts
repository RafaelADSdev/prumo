import { flushSync } from "react-dom";
let keyboard = false;
let viewAnimation: Animation | null = null;
export function installInputTracking() {
  const key = () => {
    keyboard = true;
    document.documentElement.dataset.input = "keyboard";
  };
  const pointer = () => {
    keyboard = false;
    document.documentElement.dataset.input = "pointer";
  };
  document.addEventListener("keydown", key, true);
  document.addEventListener("pointerdown", pointer, true);
  return () => {
    document.removeEventListener("keydown", key, true);
    document.removeEventListener("pointerdown", pointer, true);
  };
}
export function canAnimate() {
  return (
    typeof window !== "undefined" &&
    !keyboard &&
    document.documentElement.dataset.motion !== "reduced" &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function changeView(update: () => void) {
  viewAnimation?.cancel();
  flushSync(update);
  if (!canAnimate()) return;
  const content = document.querySelector<HTMLElement>(".page-content");
  if (!content) return;
  viewAnimation = content.animate(
    [
      { opacity: 0.6, transform: "translateY(7px)", filter: "blur(1px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
  );
}
export function revealDialog(dialog: HTMLDialogElement) {
  if (!canAnimate()) return;
  dialog.getAnimations().forEach((a) => a.cancel());
  dialog.animate(
    [
      {
        opacity: 0.65,
        transform: "translateY(12px) scale(.985)",
        filter: "blur(2px)",
      },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { duration: 240, easing: "cubic-bezier(.16,1,.3,1)" },
  );
}
export async function dismissDialog(
  dialog: HTMLDialogElement | null,
  close: () => void,
) {
  if (!dialog?.open || !canAnimate()) {
    close();
    return;
  }
  dialog.getAnimations().forEach((a) => a.cancel());
  try {
    await dialog.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(5px) scale(.99)" },
      ],
      { duration: 120, easing: "cubic-bezier(.4,0,1,1)" },
    ).finished;
  } catch {}
  close();
}
