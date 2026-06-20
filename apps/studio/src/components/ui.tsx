/** Small shared presentational atoms used across every view. */
import { useState, type ReactNode } from "react";
import { Check, Copy, type LucideIcon } from "lucide-react";
import { layerColor, nodeIcon } from "../graph/nodeStyle";
import { copyText, locationLabel } from "../lib/format";
import type { Confidence } from "../types";

export function NodeTypeIcon({
  type,
  layer,
  size = 20,
}: {
  type: string;
  layer: string;
  size?: number;
}): ReactNode {
  const Icon = nodeIcon(type);
  return (
    <span
      className="rf-node-icon"
      style={{ background: layerColor(layer), width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.2} />
    </span>
  );
}

export function LayerBadge({ layer }: { layer: string }): ReactNode {
  return (
    <span className="badge">
      <span className="swatch" style={{ background: layerColor(layer) }} />
      {layer}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }): ReactNode {
  return <span className="tag">{type}</span>;
}

const CONF_CLASS: Record<Confidence, string> = {
  extracted: "conf-extracted",
  linked: "conf-linked",
  semantic: "conf-semantic",
  manual: "conf-manual",
};

const CONF_HELP: Record<Confidence, string> = {
  extracted: "parsed directly from source",
  linked: "resolved by deterministic rules",
  semantic: "inferred by similarity (opt-in)",
  manual: "asserted by a human",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence | string }): ReactNode {
  const cls = CONF_CLASS[confidence as Confidence] ?? "";
  const tip = CONF_HELP[confidence as Confidence] ?? "";
  return (
    <span className={`tag ${cls}`} data-tip={tip || undefined}>
      {confidence}
    </span>
  );
}

export function Loc({
  node,
  onClick,
}: {
  node: { sourcePath?: string; lineStart?: number; lineEnd?: number };
  onClick?: () => void;
}): ReactNode {
  const text = locationLabel(node);
  if (!text) return null;
  if (!onClick) return <span className="mono wrap-anywhere muted">{text}</span>;
  return (
    <button
      type="button"
      className="mono wrap-anywhere"
      onClick={onClick}
      style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", textAlign: "left" }}
    >
      {text}
    </button>
  );
}

export function Meter({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone?: "ok" | "warn";
}): ReactNode {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`meter ${tone ?? ""}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CopyButton({
  getText,
  label = "Copy",
}: {
  getText: () => string;
  label?: string;
}): ReactNode {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        const ok = await copyText(getText());
        if (ok) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        }
      }}
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

export function Empty({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="empty">
      <div className="empty-inner">
        <Icon size={28} strokeWidth={1.5} />
        <div style={{ fontWeight: 600, color: "var(--text-muted)" }}>{title}</div>
        {hint && <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>{hint}</div>}
        {children}
      </div>
    </div>
  );
}

export function Spinner(): ReactNode {
  return <span className="spinner" aria-label="loading" />;
}

/** A compact, reusable row for a node-like entity: icon, label, location, reason. */
export function EntityRow({
  node,
  reason,
  right,
  onClick,
}: {
  node: {
    id?: string;
    type: string;
    layer: string;
    label: string;
    sourcePath?: string;
    lineStart?: number;
    lineEnd?: number;
  };
  reason?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}): ReactNode {
  const inner = (
    <>
      <NodeTypeIcon type={node.type} layer={node.layer} size={20} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="rel-label" style={{ display: "block", fontWeight: 600 }} dir="auto">
          {node.label}
        </span>
        {node.sourcePath && (
          <span className="mono faint" style={{ fontSize: "var(--fs-xs)", display: "block" }}>
            {locationLabel(node)}
          </span>
        )}
        {reason && (
          <span className="muted" style={{ fontSize: "var(--fs-xs)", display: "block", marginTop: 2 }}>
            {reason}
          </span>
        )}
      </span>
      {right}
    </>
  );
  if (onClick) {
    return (
      <div className="rel" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          className="row grow"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minWidth: 0, alignItems: "flex-start", textAlign: "left" }}
          onClick={onClick}
        >
          {inner}
        </button>
      </div>
    );
  }
  return (
    <div className="rel" style={{ alignItems: "flex-start", cursor: "default" }}>
      {inner}
    </div>
  );
}

export function SectionCard({
  title,
  icon: Icon,
  right,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="card">
      <div className="card-title spread" style={{ display: "flex" }}>
        <span className="row" style={{ gap: 6 }}>
          {Icon && <Icon size={13} />}
          {title}
        </span>
        {right}
      </div>
      {children}
    </section>
  );
}
