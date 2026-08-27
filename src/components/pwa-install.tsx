"use client";

import { Download, RefreshCw, Share } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const platformCheck = window.requestAnimationFrame(() => {
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    });

    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstall);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      });
    }

    return () => {
      window.cancelAnimationFrame(platformCheck);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    if (isIos) setShowIosHelp((current) => !current);
  };

  if (updateReady) {
    return (
      <button className="install-button update-button" type="button" onClick={() => window.location.reload()}>
        <RefreshCw size={16} aria-hidden="true" />
        Update ready
      </button>
    );
  }

  if (!installPrompt && !isIos) return null;

  return (
    <div className="install-wrap">
      <button className="install-button" type="button" onClick={install}>
        <Download size={16} aria-hidden="true" />
        Install app
      </button>
      {showIosHelp ? (
        <div className="ios-install-tip" role="status">
          <Share size={16} aria-hidden="true" />
          Tap Share, then “Add to Home Screen”.
        </div>
      ) : null}
    </div>
  );
}
