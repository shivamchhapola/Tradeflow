/**
 * Preload script — runs in a privileged context before the renderer loads.
 * Exposes a minimal, safe API surface to the renderer via contextBridge.
 * Never expose ipcRenderer directly — that would be a security hole.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  // Let the renderer know whether the window is currently maximized
  // so the maximize button can toggle between maximize and restore icons.
  onMaximizeChange: (cb) => {
    ipcRenderer.on("window-maximized", (_, isMaximized) => cb(isMaximized));
  },
  removeMaximizeListener: () => {
    ipcRenderer.removeAllListeners("window-maximized");
  },
});
