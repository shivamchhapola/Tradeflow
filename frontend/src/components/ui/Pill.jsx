/**
 * Pill — unified small status / direction / signal label.
 * Variants map to design tokens; shape and font come from the .pill class.
 *
 * Renders a <span> by default. Pass `as="button"` to make it interactive
 * (e.g. as a popover trigger); the .pill-interactive modifier wires up
 * the button reset (no default browser background/border/padding) and a
 * subtle hover state without losing the variant's color theme.
 */
const VARIANTS = new Set([
  "bull",
  "bear",
  "flat",
  "amber",
  "blue",
  "quest",
  "xp",
  "accent",
  "muted",
]);

export default function Pill({
  variant = "muted",
  icon,
  children,
  className = "",
  as = "span",
  ...rest
}) {
  const v = VARIANTS.has(variant) ? variant : "muted";
  const Tag = as === "button" ? "button" : "span";
  const interactiveCls = as === "button" ? " pill-interactive" : "";
  const buttonProps = as === "button" ? { type: rest.type ?? "button" } : {};
  return (
    <Tag
      className={`pill pill-${v}${interactiveCls} ${className}`.trim()}
      {...buttonProps}
      {...rest}
    >
      {icon}
      {children}
    </Tag>
  );
}
