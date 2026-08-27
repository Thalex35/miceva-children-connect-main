"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopUpdater", {
  getState: () => ipcRenderer.invoke("desktop-updater:get-state"),
  isPackaged: () => ipcRenderer.invoke("desktop-updater:is-packaged"),
  check: () => ipcRenderer.invoke("desktop-updater:check"),
  download: () => ipcRenderer.invoke("desktop-updater:download"),
  install: () => ipcRenderer.invoke("desktop-updater:install"),
  onStateChange: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("desktop-updater:state", handler);
    return () => ipcRenderer.removeListener("desktop-updater:state", handler);
  },
});
