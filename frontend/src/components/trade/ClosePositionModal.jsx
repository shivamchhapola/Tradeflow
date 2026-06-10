import { useEffect, useState } from "react";

import Modal from "../ui/Modal";
import { inrPrecise, num as fmtNum } from "../../lib/format";

export default function ClosePositionModal({ trade, onClose, onConfirm }) {
  const [exitPrice, setExitPrice] = useState("");
  const [reason, setReason] = useState("manual");

  useEffect(() => {
    if (trade) setExitPrice(String(trade.entry_price ?? ""));
  }, [trade]);

  return (
    <Modal open={!!trade} onClose={onClose} title="Close position">
      {trade && (
        <>
          <div className="close-position-summary">
            <strong>{trade.instrument}</strong>
            <span>
              {trade.direction === "BUY" ? "Long" : "Short"} · Entry {inrPrecise(trade.entry_price)} · Qty {fmtNum(trade.quantity)}
            </span>
          </div>

          <div className="form-group close-position-field">
            <label className="form-label">Exit price</label>
            <input
              autoFocus
              type="number"
              step="0.05"
              className="form-input numeric"
              value={exitPrice}
              onChange={(event) => setExitPrice(event.target.value)}
            />
          </div>

          <div className="form-group close-position-field">
            <label className="form-label">Exit reason</label>
            <div className="segmented">
              {[
                { value: "target_hit", label: "Target", tone: "bull" },
                { value: "stop_hit", label: "Stop", tone: "bear" },
                { value: "manual", label: "Manual", tone: "" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`segmented-btn ${reason === item.value ? `active ${item.tone}` : ""}`}
                  onClick={() => setReason(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onConfirm(trade.id, parseFloat(exitPrice), reason)}>
              Confirm close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
