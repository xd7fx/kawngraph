/** Docs tab: documents + sections and the code/routes/tables they explain. */
import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, CornerDownRight, FileText, Search } from "lucide-react";
import { useStudio } from "../studioContext";
import { humanize } from "../graph/nodeStyle";
import { ConfidenceBadge, EntityRow, Empty } from "../components/ui";
import type { AtharEdge, AtharNode } from "../types";

const EXPLAIN_EDGES = new Set(["explains", "documents", "mentions", "depicts"]);

export function DocsView(): ReactNode {
  const { graph, nodeById, actions } = useStudio();
  const [q, setQ] = useState("");

  const { docs, sectionsByDoc, explainsBySource } = useMemo(() => {
    const docs = graph.nodes.filter((n) => n.type === "doc");
    const sectionsByDoc = new Map<string, AtharNode[]>();
    for (const e of graph.edges) {
      if (e.type !== "belongs_to") continue;
      const child = nodeById.get(e.from);
      if (child?.type !== "section") continue;
      const arr = sectionsByDoc.get(e.to) ?? [];
      arr.push(child);
      sectionsByDoc.set(e.to, arr);
    }
    const explainsBySource = new Map<string, AtharEdge[]>();
    for (const e of graph.edges) {
      if (!EXPLAIN_EDGES.has(e.type)) continue;
      const arr = explainsBySource.get(e.from) ?? [];
      arr.push(e);
      explainsBySource.set(e.from, arr);
    }
    return { docs, sectionsByDoc, explainsBySource };
  }, [graph, nodeById]);

  const needle = q.trim().toLowerCase();
  const matches = (n: AtharNode): boolean =>
    !needle || n.label.toLowerCase().includes(needle) || n.sourcePath.toLowerCase().includes(needle);

  const visibleDocs = useMemo(() => {
    if (!needle) return docs;
    return docs.filter(
      (d) => matches(d) || (sectionsByDoc.get(d.id) ?? []).some((s) => matches(s)),
    );
  }, [docs, needle, sectionsByDoc]);

  const explainsFor = (sourceId: string): ReactNode => {
    const edges = explainsBySource.get(sourceId) ?? [];
    if (edges.length === 0) return null;
    return (
      <div className="col" style={{ gap: 4, marginTop: 4 }}>
        {edges.map((e) => {
          const target = nodeById.get(e.to);
          return (
            <EntityRow
              key={e.id}
              node={target ?? { type: "file", layer: "code", label: e.to }}
              reason={
                <span className="row" style={{ gap: 6 }}>
                  <span className="pill">{humanize(e.type)}</span>
                  <ConfidenceBadge confidence={e.confidence} />
                </span>
              }
              onClick={() => target && actions.selectNode(target.id)}
            />
          );
        })}
      </div>
    );
  };

  if (docs.length === 0) {
    return (
      <div className="section-stack">
        <Empty
          icon={BookOpen}
          title="No documents in this graph"
          hint="Add Markdown docs to your repo and re-scan to populate the docs layer."
        />
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="search" style={{ maxWidth: 360 }}>
        <Search size={14} className="faint" />
        <input
          placeholder="Search headings & docs…"
          value={q}
          dir="auto"
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search documents"
        />
      </div>

      {visibleDocs.length === 0 && (
        <Empty icon={Search} title="No matching docs" hint="Try a different search term." />
      )}

      {visibleDocs.map((doc) => {
        const sections = (sectionsByDoc.get(doc.id) ?? []).filter((s) => !needle || matches(s) || matches(doc));
        return (
          <section className="card" key={doc.id}>
            <div className="row spread" style={{ marginBottom: 8 }}>
              <EntityRow node={doc} onClick={() => actions.selectNode(doc.id)} />
              <button type="button" className="btn btn-sm" onClick={() => actions.openInGraph(doc.id)}>
                Open in graph
              </button>
            </div>
            {explainsFor(doc.id)}

            {sections.length > 0 && (
              <div className="col" style={{ gap: 8, marginTop: 10 }}>
                {sections.map((s) => (
                  <div key={s.id} style={{ borderLeft: "2px solid var(--border)", paddingLeft: 10 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <CornerDownRight size={13} className="faint" />
                      <button
                        type="button"
                        className="grow"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontWeight: 600 }}
                        onClick={() => actions.selectNode(s.id)}
                        dir="auto"
                      >
                        {s.label}
                      </button>
                      <FileText size={12} className="faint" />
                    </div>
                    {explainsFor(s.id)}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
