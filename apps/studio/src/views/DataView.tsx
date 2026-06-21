/** Data tab: SQL tables + migrations, their readers/writers and connections. */
import { useMemo, useState, type ReactNode } from "react";
import { Database, Download, GitCommitVertical, Search, Upload, Workflow } from "lucide-react";
import { useStudio } from "../studioContext";
import { humanize } from "../graph/nodeStyle";
import { ConfidenceBadge, EntityRow, Empty } from "../components/ui";
import type { KawnEdge, KawnNode } from "../types";

const RELATED_EDGES = new Set(["documents", "explains", "mentions", "tests", "references", "depends_on"]);

export function DataView(): ReactNode {
  const { graph, nodeById, actions } = useStudio();
  const [q, setQ] = useState("");

  const tables = useMemo(() => graph.nodes.filter((n) => n.type === "table"), [graph]);
  const migrations = useMemo(() => graph.nodes.filter((n) => n.type === "migration"), [graph]);

  const index = useMemo(() => {
    const writers = new Map<string, KawnEdge[]>();
    const readers = new Map<string, KawnEdge[]>();
    const related = new Map<string, KawnEdge[]>();
    const migrationsOf = new Map<string, KawnNode[]>();
    const push = (map: Map<string, KawnEdge[]>, key: string, e: KawnEdge): void => {
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    };
    for (const e of graph.edges) {
      if (e.type === "writes_table") push(writers, e.to, e);
      else if (e.type === "reads_table") push(readers, e.to, e);
      else if (e.type === "changed_by") {
        const mig = nodeById.get(e.to);
        if (mig?.type === "migration") {
          const arr = migrationsOf.get(e.from) ?? [];
          arr.push(mig);
          migrationsOf.set(e.from, arr);
        }
      }
      // related: any edge touching a table with a meaningful relationship
      if (RELATED_EDGES.has(e.type)) {
        const fromNode = nodeById.get(e.from);
        const toNode = nodeById.get(e.to);
        if (toNode?.type === "table") push(related, e.to, e);
        else if (fromNode?.type === "table") push(related, e.from, e);
      }
    }
    return { writers, readers, related, migrationsOf };
  }, [graph, nodeById]);

  const needle = q.trim().toLowerCase();
  const visibleTables = tables.filter(
    (t) => !needle || t.label.toLowerCase().includes(needle) || t.sourcePath.toLowerCase().includes(needle),
  );

  const renderEdgeList = (edges: KawnEdge[], pickOther: (e: KawnEdge) => string): ReactNode => (
    <div className="col" style={{ gap: 5 }}>
      {edges.map((e) => {
        const other = nodeById.get(pickOther(e));
        return (
          <EntityRow
            key={e.id}
            node={other ?? { type: "file", layer: "code", label: pickOther(e) }}
            reason={
              <span className="row" style={{ gap: 6 }}>
                <span className="pill">{humanize(e.type)}</span>
                <ConfidenceBadge confidence={e.confidence} />
              </span>
            }
            onClick={() => other && actions.selectNode(other.id)}
          />
        );
      })}
    </div>
  );

  if (tables.length === 0 && migrations.length === 0) {
    return (
      <div className="section-stack">
        <Empty
          icon={Database}
          title="No data layer in this graph"
          hint="Add SQL migrations / schema files to your repo and re-scan to populate tables."
        />
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="search" style={{ maxWidth: 360 }}>
          <Search size={14} className="faint" />
          <input
            placeholder="Search tables…"
            value={q}
            dir="auto"
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search tables"
          />
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge">{tables.length} tables</span>
          <span className="badge">{migrations.length} migrations</span>
        </div>
      </div>

      {visibleTables.map((t) => {
        const writers = index.writers.get(t.id) ?? [];
        const readers = index.readers.get(t.id) ?? [];
        const related = (index.related.get(t.id) ?? []).filter(
          (e) => e.type !== "reads_table" && e.type !== "writes_table",
        );
        const migs = index.migrationsOf.get(t.id) ?? [];
        return (
          <section className="card" key={t.id}>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <EntityRow node={t} onClick={() => actions.selectNode(t.id)} />
              <button type="button" className="btn btn-sm" onClick={() => actions.openInGraph(t.id)}>
                Open in graph
              </button>
            </div>
            <div className="form-grid">
              <div>
                <div className="card-title">
                  <Upload size={12} /> Writers ({writers.length})
                </div>
                {writers.length ? renderEdgeList(writers, (e) => e.from) : <span className="faint" style={{ fontSize: "var(--fs-sm)" }}>None.</span>}
              </div>
              <div>
                <div className="card-title">
                  <Download size={12} /> Readers ({readers.length})
                </div>
                {readers.length ? renderEdgeList(readers, (e) => e.from) : <span className="faint" style={{ fontSize: "var(--fs-sm)" }}>None.</span>}
              </div>
            </div>
            {related.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="card-title">
                  <Workflow size={12} /> Connected ({related.length})
                </div>
                {renderEdgeList(related, (e) => (e.from === t.id ? e.to : e.from))}
              </div>
            )}
            {migs.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="card-title">
                  <GitCommitVertical size={12} /> Migrations ({migs.length})
                </div>
                <div className="col" style={{ gap: 5 }}>
                  {migs.map((m) => (
                    <EntityRow key={m.id} node={m} onClick={() => actions.selectNode(m.id)} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}

      {migrations.length > 0 && (
        <section className="card card-sunken">
          <div className="card-title">
            <GitCommitVertical size={13} /> All migrations ({migrations.length})
          </div>
          <div className="col" style={{ gap: 5 }}>
            {migrations.map((m) => (
              <EntityRow key={m.id} node={m} onClick={() => actions.selectNode(m.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
