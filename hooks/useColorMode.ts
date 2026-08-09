"use client";

import { useEffect } from "react";
import useLocalStorage from "./useLocalStorage";

export type Theme = "light" | "dark";

const getTimeBasedTheme = (): Theme => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
};

const useColorMode = () => {
  const [colorMode, setColorMode] = useLocalStorage<Theme>(
    "color-theme",
    "light"
  );

  // Set time-based theme only if user has never chosen
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("color-theme");
    if (!stored) {
      const timeTheme = getTimeBasedTheme();
      setColorMode(timeTheme);
    }
  }, [setColorMode]);

  // Apply theme classes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("light", "dark");
    body.classList.remove("light", "dark");

    root.classList.add(colorMode);
    body.classList.add(colorMode);
  }, [colorMode]);

  return [colorMode, setColorMode] as const;
};

export default useColorMode;
