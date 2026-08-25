import { NavLink, useLocation } from "react-router-dom";
import { LineChart, ArrowLeftRight, Briefcase, BookOpen, GraduationCap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { NAV } from "../../lib/copy";

import { useUnsavedChanges } from "../../context/UnsavedChangesContext";

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { confirmNavigation } = useUnsavedChanges();
  const noChrome = location.pathname === "/login" || location.pathname === "/signup";

  if (noChrome || !user) return null;

  const handleNavClick = (to, e) => {
    if (!confirmNavigation(to)) {
      e.preventDefault();
    }
  };

  return (
    <nav className="bottom-nav" aria-label="Primary (mobile)">
      <NavLink to="/" end className="bottom-nav-tab" onClick={(e) => handleNavClick("/", e)}>
        <span className="bottom-nav-icon" aria-hidden>
          <LineChart size={20} strokeWidth={2.2} />
        </span>
        <span className="bottom-nav-label">{NAV.links.analysis}</span>
      </NavLink>
      <NavLink to="/trade" className="bottom-nav-tab" onClick={(e) => handleNavClick("/trade", e)}>
        <span className="bottom-nav-icon" aria-hidden>
          <ArrowLeftRight size={20} strokeWidth={2.2} />
        </span>
        <span className="bottom-nav-label">{NAV.links.trade}</span>
      </NavLink>
      <NavLink to="/portfolio" className="bottom-nav-tab" onClick={(e) => handleNavClick("/portfolio", e)}>
        <span className="bottom-nav-icon" aria-hidden>
          <Briefcase size={20} strokeWidth={2.2} />
        </span>
        <span className="bottom-nav-label">{NAV.links.portfolio}</span>
      </NavLink>
      <NavLink to="/reports" className="bottom-nav-tab" onClick={(e) => handleNavClick("/reports", e)}>
        <span className="bottom-nav-icon" aria-hidden>
          <BookOpen size={20} strokeWidth={2.2} />
        </span>
        <span className="bottom-nav-label">{NAV.links.reports}</span>
      </NavLink>
      <NavLink to="/learn" className="bottom-nav-tab" onClick={(e) => handleNavClick("/learn", e)}>
        <span className="bottom-nav-icon" aria-hidden>
          <GraduationCap size={20} strokeWidth={2.2} />
        </span>
        <span className="bottom-nav-label">{NAV.links.learn}</span>
      </NavLink>
    </nav>
  );
}
