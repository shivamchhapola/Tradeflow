import { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    
    // Listen for maximize state changes from main process
    window.electronAPI.onMaximizeChange((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      window.electronAPI.removeMaximizeListener();
    };
  }, []);

  if (!window.electronAPI) {
    return <div style={{ color: 'red', zIndex: 9999 }}>NO API</div>;
  }

  return (
    <div className="window-controls">
      <button 
        className="window-control-btn" 
        onClick={() => window.electronAPI.minimize()}
        title="Minimize"
        tabIndex={-1}
      >
        <Minus size={14} />
      </button>
      <button 
        className="window-control-btn" 
        onClick={() => window.electronAPI.maximize()}
        title={isMaximized ? "Restore Down" : "Maximize"}
        tabIndex={-1}
      >
        {isMaximized ? (
          <Copy size={12} style={{ transform: 'scaleY(-1)' }} />
        ) : (
          <Square size={12} />
        )}
      </button>
      <button 
        className="window-control-btn close-btn" 
        onClick={() => window.electronAPI.close()}
        title="Close"
        tabIndex={-1}
      >
        <X size={16} />
      </button>
    </div>
  );
}
