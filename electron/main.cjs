const { app, BrowserWindow, ipcMain, shell, session } = require("electron");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://miceva-children-connect-main.vercel.app";
const APP_ORIGIN = new URL(APP_URL).origin;
let updateState = {
  status: "idle",
  currentVersion: app.getVersion(),
};
let updaterConfigured = false;

function isTrustedUrl(value) {
  try {
    return new URL(value).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: require("path").join(__dirname, "preload.cjs"),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isContactUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
      return;
    }
    if (!isTrustedUrl(url)) event.preventDefault();
  });

  void window.loadURL(APP_URL);
}

function configureAutoUpdates() {
  if (!app.isPackaged || updaterConfigured) return;
  updaterConfigured = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const publishState = (nextState) => {
    updateState = { ...updateState, ...nextState };
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop-updater:state", updateState);
    }
  };

  autoUpdater.on("checking-for-update", () =>
    publishState({ status: "checking", message: undefined }),
  );
  autoUpdater.on("update-not-available", () =>
    publishState({ status: "up-to-date", message: undefined }),
  );
  autoUpdater.on("update-available", (info) => {
    publishState({
      status: "available",
      availableVersion: info.version,
      progress: 0,
      message: undefined,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    publishState({ status: "downloading", progress: progress.percent });
    const window = BrowserWindow.getAllWindows()[0];
    if (window) window.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on("update-downloaded", (info) => {
    publishState({
      status: "downloaded",
      availableVersion: info.version,
      progress: 100,
      message: undefined,
    });
    const window = BrowserWindow.getAllWindows()[0];
    if (window) window.setProgressBar(-1);
  });

  autoUpdater.on("error", (error) => {
    publishState({ status: "error", message: "Updates are temporarily unavailable." });
    console.error("Update check failed", error.message);
  });

  setTimeout(
    () =>
      autoUpdater.checkForUpdates().catch((error) => console.error("Update check failed", error)),
    5000,
  );
}

ipcMain.handle("desktop-updater:is-packaged", () => app.isPackaged);
ipcMain.handle("desktop-updater:get-state", () => updateState);
ipcMain.handle("desktop-updater:check", async () => {
  if (!app.isPackaged) return { ...updateState, status: "disabled" };
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("Update check failed", error.message);
  }
  return updateState;
});
ipcMain.handle("desktop-updater:download", async () => {
  if (app.isPackaged) await autoUpdater.downloadUpdate();
  return updateState;
});
ipcMain.handle("desktop-updater:install", () => {
  if (app.isPackaged && updateState.status === "downloaded") autoUpdater.quitAndInstall();
});
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "notifications");
  });
  createWindow();
  configureAutoUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
