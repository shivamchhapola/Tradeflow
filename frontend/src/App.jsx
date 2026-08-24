import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Tooltip } from "react-tooltip";
import AuthWrapper from "./components/AuthWrapper";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import SetupGuard from "./components/SetupGuard";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Nav from "./components/layout/Nav";
import BottomNav from "./components/layout/BottomNav";
import { RouteFallback, NotFound } from "./components/layout/RouteFallback";

import { NotificationProvider } from "./context/NotificationContext";
import ErrorDetailsModal from "./components/notifications/ErrorDetailsModal";

import "react-tooltip/dist/react-tooltip.css";
import "./App.css";

// Heavy / non-critical routes are lazy so recharts + framer-motion don't ship in the
// initial bundle when the user lands on Dashboard.
const Trade = lazy(() => import("./pages/Trade"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Reports = lazy(() => import("./pages/Reports"));
const Learn = lazy(() => import("./pages/Learn"));
const Settings = lazy(() => import("./pages/Settings"));

function AppContent() {
  const location = useLocation();
  return (
    <div className="app">
      <Nav />
      <main className={`main ${location.pathname === "/trade" ? "main-trade" : ""} ${(location.pathname === "/login" || location.pathname === "/signup") ? "main-auth" : ""}`}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/trade" element={<Trade />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
      <ErrorDetailsModal />
    </div>
  );
}

export default function App() {
  return (
    <>
      <BrowserRouter>
        <AuthWrapper>
          <ErrorBoundary>
            <NotificationProvider>
              <SetupGuard>
                <AppContent />
              </SetupGuard>
            </NotificationProvider>
          </ErrorBoundary>
        </AuthWrapper>
      </BrowserRouter>
      {/* Tooltip mounted at root, OUTSIDE the router & ErrorBoundary, so no
          ancestor stacking context / overflow:hidden / transform can clip it. */}
      <Tooltip
        id="global-tooltip"
        className="react-tooltip"
        events={["hover", "focus"]}
        delayShow={120}
        opacity={1}
        offset={6}
      />
    </>
  );
}



