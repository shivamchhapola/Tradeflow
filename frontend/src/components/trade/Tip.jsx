import { useState } from "react";

export default function Tip({ content, children }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="trade-tip"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && <span className="trade-tip-popover">{content}</span>}
    </span>
  );
}

export function ColHeader({ label, tip }) {
  if (!tip) return <span>{label}</span>;
  return (
    <Tip content={tip}>
      <span className="trade-help-text">{label}</span>
    </Tip>
  );
}
