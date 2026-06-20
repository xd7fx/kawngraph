/** Right-hand inspector: full details for the selected node or edge. */
import { type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  Crosshair,
  GitFork,
  Layers,
  PanelRightClose,
  Package2,
  Route as RouteIcon,
  X,
} from "lucide-react";
import { useStudio } from "../studioContext";
import type { AtharEdge, AtharNode } from "../types";
import { humanize } from "../graph/nodeStyle";
import { ConfidenceBadge, Empty, LayerBadge, Loc, NodeTypeIcon, TypeBadge } from "./ui";

function metaEntries(meta: Record<string, unknown> | undefined): [string, string][] {
  if (!meta) return [];
  return Object.entries(meta).map(([k, v]) => [
    k,
    typeof v === "object" ? JSON.stringify(v) : String(v),
  ]);
}

function RelationRow({
  edge,
  other,
  direction,
  onNavigate,
  onEvidence,
}: {
  edge: AtharEdge;
  other: AtharNode | undefined;
  direction: "out" | "in";
  onNavigate: () => void;
  onEvidence: () => void;
}): ReactNode {
  return (
    <div className="rel">
      <button
        type="button"
        className="row grow"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minWidth: 0 }}
        onClick={onNavigate}
        title={other ? other.id : `${edge.from} → ${edge.to}`}
      >
        <ArrowRight
          size={13}
          style={{
            color: "var(--text-faint)",
            transform: direction === "in" ? "rotate(180deg)" : undefined,
            flexShrink: 0,
          }}
        />
        <span className="pill">{humanize(edge.type)}</span>
        {other && <NodeTypeIcon type={other.type} layer={other.layer} size={16} />}
        <span className="rel-label" dir="auto">
          {other ? other.label : direction === "out" ? edge.to : edge.from}
        </span>
      </button>
      <button
        type="button"
        className="icon-btn"
        style={{ width: 24, height: 24 }}
        data-tip="View edge evidence"
        onClick={onEvidence}
      >
        <ConfidenceBadgeDot confidence={edge.confidence} />
      </button>
    </div>
  );
}

function ConfidenceBadgeDot({ confidence }: { confidence: string }): ReactNode {
  const color =
    confidence === "extracted"
      ? "var(--ok)"
      : confidence === "linked"
        ? "var(--accent)"
        : confidence === "semantic"
          ? "var(--warn)"
          : "var(--text-muted)";
  return <span className="swatch" style={{ background: color, width: 8, height: 8 }} />;
}

function NodeDetails({ node }: { node: AtharNode }): ReactNode {
  const { graph, nodeById, actions } = useStudio();
  const outgoing = graph.edges.filter((e) => e.from === node.id);
  const incoming = graph.edges.filter((e) => e.to === node.id);
  const meta = metaEntries(node.metadata);

  return (
    <>
      <section>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <NodeTypeIcon type={node.type} layer={node.layer} size={26} />
          <div className="grow">
            <div style={{ fontWeight: 650, fontSize: "var(--fs-lg)" }} className="wrap-anywhere" dir="auto">
              {node.label}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 3 }}>
              <LayerBadge layer={node.layer} />
              <TypeBadge type={node.type} />
            </div>
          </div>
        </div>
        <dl className="kv">
          <dt>ID</dt>
          <dd className="mono wrap-anywhere">{node.id}</dd>
          <dt>Source</dt>
          <dd>
            <Loc node={node} />
          </dd>
        </dl>
      </section>

      {meta.length > 0 && (
        <section className="card card-sunken">
          <div className="card-title">
            <Package2 size={13} /> Metadata
          </div>
          <dl className="kv">
            {meta.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd className="wrap-anywhere">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section>
        <div className="card-title">
          <GitFork size={13} /> Relationships ({outgoing.length + incoming.length})
        </div>
        <div className="col" style={{ gap: 5 }}>
          {outgoing.length === 0 && incoming.length === 0 && (
            <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>
              No relationships.
            </div>
          )}
          {outgoing.map((e) => (
            <RelationRow
              key={e.id}
              edge={e}
              other={nodeById.get(e.to)}
              direction="out"
              onNavigate={() => actions.selectNode(e.to)}
              onEvidence={() => actions.selectEdge(e)}
            />
          ))}
          {incoming.map((e) => (
            <RelationRow
              key={e.id}
              edge={e}
              other={nodeById.get(e.from)}
              direction="in"
              onNavigate={() => actions.selectNode(e.from)}
              onEvidence={() => actions.selectEdge(e)}
            />
          ))}
        </div>
      </section>

      <section className="col" style={{ gap: 6 }}>
        <div className="card-title">Actions</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => actions.openInGraph(node.id)}>
            <Crosshair size={13} /> Focus neighbors
          </button>
          <button type="button" className="btn btn-sm" onClick={() => actions.showImpact(node.id)}>
            <Layers size={13} /> Show impact
          </button>
          <button type="button" className="btn btn-sm" onClick={() => actions.buildContext(node.label)}>
            <Package2 size={13} /> Build context
          </button>
          <button type="button" className="btn btn-sm" onClick={() => actions.showFlow(node.id, "")}>
            <RouteIcon size={13} /> Flow from…
          </button>
        </div>
      </section>
    </>
  );
}

function EdgeDetails({ edge }: { edge: AtharEdge }): ReactNode {
  const { nodeById, actions } = useStudio();
  const from = nodeById.get(edge.from);
  const to = nodeById.get(edge.to);
  const ev = edge.evidence;

  return (
    <>
      <section>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <span className="rf-node-icon" style={{ background: "var(--accent)", width: 26, height: 26 }}>
            <ArrowLeftRight size={15} />
          </span>
          <div className="grow">
            <div style={{ fontWeight: 650, fontSize: "var(--fs-lg)" }}>{humanize(edge.type)}</div>
            <div className="row" style={{ gap: 6, marginTop: 3 }}>
              <ConfidenceBadge confidence={edge.confidence} />
            </div>
          </div>
        </div>
      </section>

      <section className="col" style={{ gap: 6 }}>
        <div className="card-title">Endpoints</div>
        <button type="button" className="rel" onClick={() => actions.selectNode(edge.from)}>
          {from && <NodeTypeIcon type={from.type} layer={from.layer} size={18} />}
          <span className="rel-label" dir="auto">{from ? from.label : edge.from}</span>
          <span className="faint" style={{ fontSize: 10 }}>source</span>
        </button>
        <div className="row" style={{ justifyContent: "center" }}>
          <ArrowRight size={14} className="faint" />
        </div>
        <button type="button" className="rel" onClick={() => actions.selectNode(edge.to)}>
          {to && <NodeTypeIcon type={to.type} layer={to.layer} size={18} />}
          <span className="rel-label" dir="auto">{to ? to.label : edge.to}</span>
          <span className="faint" style={{ fontSize: 10 }}>target</span>
        </button>
      </section>

      <section>
        <div className="card-title">Evidence</div>
        {ev ? (
          <div className="col" style={{ gap: 8 }}>
            <Loc node={ev} />
            {ev.snippet ? (
              <pre className="snippet" dir="auto">
                {ev.snippet}
              </pre>
            ) : (
              <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>
                No snippet captured for this edge.
              </div>
            )}
          </div>
        ) : (
          <div className="faint" style={{ fontSize: "var(--fs-sm)" }}>
            This edge has no recorded evidence.
          </div>
        )}
      </section>
    </>
  );
}

export function RightPanel({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const { selection, actions } = useStudio();

  return (
    <aside className={`rightpanel ${open ? "" : "closed"}`} data-panel={selection ? selection.kind : "empty"}>
      <div className="rpanel-head">
        <span className="card-title" style={{ margin: 0 }}>
          {selection ? (selection.kind === "node" ? "Node details" : "Edge details") : "Details"}
        </span>
        <div className="row" style={{ gap: 2 }}>
          {selection && (
            <button type="button" className="icon-btn" data-tip="Clear selection" onClick={actions.clearSelection}>
              <X size={15} />
            </button>
          )}
          <button type="button" className="icon-btn only-narrow" data-tip="Close panel" onClick={onClose}>
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>
      <div className="rpanel-body">
        {!selection && (
          <Empty
            icon={Crosshair}
            title="No selection"
            hint="Select a node or edge in the graph — or any result — to inspect it here."
          />
        )}
        {selection?.kind === "node" && <NodeDetails node={selection.node} />}
        {selection?.kind === "edge" && <EdgeDetails edge={selection.edge} />}
      </div>
    </aside>
  );
}
