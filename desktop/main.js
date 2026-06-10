const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

let mainWindow;
let pythonProcess = null;

// Force dark mode system-wide before any window opens
nativeTheme.themeSource = "dark";

const isPackaged = app.isPackaged;

function getIconPath() {
  if (isPackaged) {
    return path.join(process.resourcesPath, "icon.png");
  }
  return path.join(__dirname, "build", "icon.png");
}

// ---------------------------------------------------------------------------
// Loading window — frameless splash shown while Python backend starts
// ---------------------------------------------------------------------------
function createLoadingWindow() {
  const loading = new BrowserWindow({
    width: 400,
    height: 320,
    frame: false,
    backgroundColor: "#08080a",
    center: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: getIconPath(),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  loading.setMenu(null);
  loading.loadFile(path.join(__dirname, "loading.html"));
  return loading;
}

// ---------------------------------------------------------------------------
// Main application window — fully frameless, custom controls in the nav bar
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: "Tradeflow",
    icon: getIconPath(),
    show: false,
    backgroundColor: "#08080a",
    // Fully frameless — no OS titlebar at all.
    // Custom close/min/max buttons live in the React nav bar.
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      zoomFactor: 1.0,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.webContents.openDevTools(); 
  
  // Clear cache to prevent old frontend from being loaded during development
  mainWindow.webContents.session.clearCache().then(() => {
    mainWindow.loadURL("http://localhost:8000");
  });

  // Lock zoom
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  // Suppress browser context menu
  mainWindow.webContents.on("context-menu", (e) => e.preventDefault());

  // Inject `electron` body class + notify maximize state on every page load
  mainWindow.webContents.on("did-finish-load", () => {
    const isMaximized = mainWindow.isMaximized();
    mainWindow.webContents.executeJavaScript(
      `document.body.classList.add("electron");`
    );
    mainWindow.webContents.send("window-maximized", isMaximized);
  });

  // Notify renderer when maximize state changes (for the restore/maximize icon)
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC handlers — called by the custom window control buttons in the nav bar
// ---------------------------------------------------------------------------
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window-close", () => mainWindow?.close());

// ---------------------------------------------------------------------------
// Python backend process management
// ---------------------------------------------------------------------------
function startPythonBackend() {
  let backendExe;
  if (isPackaged) {
    backendExe = path.join(process.resourcesPath, "backend", "tradeflow-backend.exe");
  } else {
    backendExe = path.join(__dirname, "..", "backend", "dist", "tradeflow-backend", "tradeflow-backend.exe");
  }

  console.log("Starting Python backend from:", backendExe);
  pythonProcess = spawn(backendExe, [], { cwd: path.dirname(backendExe) });

  pythonProcess.stdout.on("data", (d) => console.log(`Backend: ${d}`));
  pythonProcess.stderr.on("data", (d) => console.error(`Backend: ${d}`));
  pythonProcess.on("close", (code) => console.log(`Backend exited: ${code}`));
}

// ---------------------------------------------------------------------------
// Wait for backend health check
// ---------------------------------------------------------------------------
function waitForBackend(url, timeoutMs = 30000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    function attempt() {
      if (Date.now() - startTime > timeoutMs) {
        return reject(new Error("Timeout waiting for backend"));
      }
      const req = http.get(url, () => resolve());
      req.on("error", () => setTimeout(attempt, intervalMs));
      req.end();
    }
    attempt();
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  const loadingWindow = createLoadingWindow();
  startPythonBackend();

  console.log("Waiting for backend to start...");
  waitForBackend("http://127.0.0.1:8000/api/settings", 30000, 500)
    .then(() => {
      console.log("Backend ready. Opening main window.");
      createWindow();
      mainWindow.once("ready-to-show", () => {
        mainWindow.show();
        setTimeout(() => loadingWindow.close(), 200);
      });
    })
    .catch((err) => {
      console.error("Backend failed to start:", err);
      loadingWindow.close();
      createWindow();
      mainWindow.once("ready-to-show", () => mainWindow.show());
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    spawn("taskkill", ["/pid", pythonProcess.pid, "/f", "/t"]);
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
