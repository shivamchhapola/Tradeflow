import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
    <Toaster
      position="bottom-right"
      theme="dark"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          color: "var(--text-primary)",
          fontFamily: "var(--font)",
          fontSize: "13px",
        },
      }}
    />
  </StrictMode>
);
