"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Could not register the TruePlanner service worker.", error);
    });
  }, []);

  return null;
}