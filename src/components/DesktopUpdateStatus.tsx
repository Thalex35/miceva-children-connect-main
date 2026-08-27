import { Download, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type UpdateState = {
  status:
    | "idle"
    | "disabled"
    | "checking"
    | "up-to-date"
    | "available"
    | "downloading"
    | "downloaded"
    | "error";
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  message?: string;
};

type DesktopUpdater = {
  getState: () => Promise<UpdateState>;
  isPackaged: () => Promise<boolean>;
  check: () => Promise<UpdateState>;
  download: () => Promise<UpdateState>;
  install: () => Promise<void>;
  onStateChange: (listener: (state: UpdateState) => void) => () => void;
};

declare global {
  interface Window {
    desktopUpdater?: DesktopUpdater;
  }
}

export function DesktopUpdateStatus() {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const updater = window.desktopUpdater;
    if (!updater) return;
    let mounted = true;
    void updater.isPackaged().then((isPackaged) => {
      if (!isPackaged || !mounted) return;
      void updater.getState().then((nextState) => mounted && setState(nextState));
      void updater.check();
    });
    const removeListener = updater.onStateChange((nextState) => {
      if (mounted) setState(nextState);
    });
    return () => {
      mounted = false;
      removeListener();
    };
  }, []);

  if (!state || ["idle", "disabled", "checking", "up-to-date"].includes(state.status)) return null;

  const isError = state.status === "error";
  const isReady = state.status === "downloaded";
  const title = isError
    ? "Update check failed"
    : isReady
      ? "Update ready"
      : state.status === "available"
        ? "A new version of Children Management is available"
        : "Downloading update";

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-2xl">
      <Alert variant={isError ? "destructive" : "default"} className="bg-background shadow-lg">
        {isError ? <TriangleAlert /> : isReady ? <RotateCw /> : <Download />}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>
            {isError
              ? state.message || "The application will continue working normally."
              : isReady
                ? `Version ${state.availableVersion} is ready. Restart to install it.`
                : state.status === "available"
                  ? `Version ${state.currentVersion} to ${state.availableVersion}.`
                  : `${Math.round(state.progress ?? 0)}% downloaded`}
          </span>
          {state.status === "available" && (
            <Button size="sm" onClick={() => void window.desktopUpdater?.download()}>
              Download update
            </Button>
          )}
          {isReady && (
            <Button size="sm" onClick={() => void window.desktopUpdater?.install()}>
              Restart and install
            </Button>
          )}
          {isError && (
            <Button size="sm" variant="outline" onClick={() => void window.desktopUpdater?.check()}>
              <RefreshCw /> Retry
            </Button>
          )}
          {state.status === "downloading" && (
            <progress
              className="h-2 min-w-32 accent-primary"
              value={state.progress ?? 0}
              max="100"
            />
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
