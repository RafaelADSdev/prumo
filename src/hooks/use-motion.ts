"use client";
import { useEffect, useState } from "react";
import { installInputTracking } from "@/lib/motion";
export function useMotion() {
  const [enabled, setEnabled] = useState(true),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem("prumo-motion") !== "off");
    } catch {}
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    const dispose = installInputTracking();
    return () => {
      media.removeEventListener("change", update);
      dispose();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion =
      !enabled || reduced ? "reduced" : "full";
  }, [enabled, reduced]);
  const toggle = () => {
    setEnabled((v) => {
      try {
        localStorage.setItem("prumo-motion", v ? "off" : "on");
      } catch {}
      return !v;
    });
  };
  return { enabled, reduced, active: enabled && !reduced, toggle };
}
