/** Changes tab: read-only git diff impact (working tree or a base ref vs HEAD). */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Database,
  FileCode,
  FileText,
  FlaskConical,
  GitCompare,
  GitBranch,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { api, ApiRequestError } from "../api";
import { useStudio } from "../studioContext";
import { useT } from "../i18nReact";
import type { TFn } from "../i18n";
import { humanize } from "../graph/nodeStyle";
import { EntityRow, Empty, Spinner } from "../components/ui";
import type { ChangedFileImpact, ChangesResponse, GitErrorCode, KawnNode } from "../types";

type Mode = "working" | "compare";

const GIT_ERROR_KEY: Record<GitErrorCode, Parameters<TFn>[0]> = {
  "git-missing": "changes.gitMissing",
  "not-a-repo": "changes.notARepo",
  "no-head": "changes.noHead",
  "bad-ref": "changes.badRef",
  "git-failed": "changes.gitFailed",
};

export function ChangesView(): ReactNode {
  const { actions, health } = useStudio();
  const t = useT();
  const [mode, setMode] = useState<Mode>("working");
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [result, setResult] = useState<ChangesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (m: Mode, baseRef: string, headRef: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const body =
        m === "compare"
          ? { base: baseRef.trim() || "HEAD~1", head: headRef.trim() || undefined }
          : {};
      const res = await api.changes(body, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResult(res);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof ApiRequestError ? err.message : t("changes.gitFailed"));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [t]);

  // Show the working tree's impact immediately on first open.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void run("working", "", "");
  }, [run]);

  // Cancel any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const impact = result?.ok ? result.impact : undefined;
  const gitError = result && !result.ok ? result.gitError : undefined;
  const inGraphCount = impact?.files.filter((f) => f.inGraph).length ?? 0;

  return (
    <div className="section-stack">
      <section className="card">
        <form
          className="col"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(mode, base, head);
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className={`btn ${mode === "working" ? "btn-primary" : ""}`}
              onClick={() => setMode("working")}
            >
              <GitBranch size={14} /> {t("changes.workingTree")}
            </button>
            <button
              type="button"
              className={`btn ${mode === "compare" ? "btn-primary" : ""}`}
              onClick={() => setMode("compare")}
            >
              <GitCompare size={14} /> {t("changes.compareRef")}
            </button>
          </div>

          {mode === "compare" && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="chg-base">{t("changes.baseRef")}</label>
                <input
                  id="chg-base"
                  className="input"
                  placeholder={t("changes.baseRefPlaceholder")}
                  value={base}
                  dir="auto"
                  onChange={(e) => setBase(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="chg-head">{t("changes.headRef")}</label>
                <input
                  id="chg-head"
                  className="input"
                  placeholder={t("changes.headRefPlaceholder")}
                  value={head}
                  dir="auto"
                  onChange={(e) => setHead(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="row spread" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
              {mode === "compare" ? t("changes.scopeCompare") : t("changes.scopeWorkingTree")}
            </span>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Spinner /> : <RefreshCw size={14} />} {t("changes.analyze")}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="banner error">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>{t("changes.gitErrorTitle")}</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {gitError && (
        <div className="banner warn">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>{t("changes.gitErrorTitle")}</h3>
            <p>{t(GIT_ERROR_KEY[gitError.code] ?? "changes.gitFailed")}</p>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <Empty icon={GitCompare} title={t("changes.emptyTitle")} hint={t("changes.emptyHint")} />
      )}

      {impact && impact.files.length === 0 && (
        <Empty icon={GitBranch} title={t("changes.cleanTitle")} hint={t("changes.cleanHint")} />
      )}

      {impact && impact.files.length > 0 && (
        <>
          <section className="card">
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="badge mono">{impact.range ?? impact.label}</span>
              <span className="badge">{t("changes.filesChanged", { n: impact.files.length })}</span>
              <span className="badge">{t("changes.inGraphCount", { n: inGraphCount })}</span>
              <span className="badge">{t("changes.impactedCount", { n: impact.impacted.length })}</span>
              <span className="badge">{t("changes.recheckCount", { n: impact.filesToRecheck.length })}</span>
            </div>
            {impact.impactTruncated && (
              <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
                {t("changes.truncated")}
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-title">
              <FileCode size={13} /> {t("changes.changedFiles")} ({impact.files.length})
            </div>
            <div className="col" style={{ gap: 4 }}>
              {impact.files.map((f) => (
                <ChangedFileRow key={f.path} file={f} t={t} onSelect={actions.selectNode} />
              ))}
            </div>
          </section>

          {impact.unmappedFiles.length > 0 && (
            <section className="card card-sunken">
              <div className="card-title">
                <AlertTriangle size={13} /> {t("changes.unmapped")} ({impact.unmappedFiles.length})
              </div>
              <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 0 }}>
                {t("changes.unmappedHint")}
              </p>
              <p style={{ margin: "4px 0 8px" }}>
                <code className="mono">kawn scan {health.root}</code>
              </p>
              <div className="col" style={{ gap: 2 }}>
                {impact.unmappedFiles.map((p) => (
                  <span key={p} className="mono wrap-anywhere" style={{ fontSize: "var(--fs-sm)" }}>
                    {p}
                  </span>
                ))}
              </div>
            </section>
          )}

          {impact.filesToRecheck.length > 0 && (
            <section className="card">
              <div className="card-title">
                <ListChecks size={13} /> {t("changes.filesToRecheck")} ({impact.filesToRecheck.length})
              </div>
              <div className="col" style={{ gap: 2 }}>
                {impact.filesToRecheck.map((p) => (
                  <span key={p} className="mono wrap-anywhere" style={{ fontSize: "var(--fs-sm)" }}>
                    {p}
                  </span>
                ))}
              </div>
            </section>
          )}

          <NodeGroup title={t("changes.relatedDocs")} icon={FileText} nodes={impact.relatedDocs} onSelect={actions.selectNode} />
          <NodeGroup title={t("changes.relatedTables")} icon={Database} nodes={impact.relatedTables} onSelect={actions.selectNode} />
          <NodeGroup title={t("changes.relatedTests")} icon={FlaskConical} nodes={impact.relatedTests} onSelect={actions.selectNode} />

          {impact.risks.length > 0 && (
            <section className="card">
              <div className="card-title">
                <AlertTriangle size={13} /> {t("changes.risks")} ({impact.risks.length})
              </div>
              <div className="col" style={{ gap: 6 }}>
                {impact.risks.map((r, i) => (
                  <div key={i} className={`risk ${r.level}`}>
                    <div className="row spread">
                      <strong>{r.kind}</strong>
                      <span className="tag">{r.level}</span>
                    </div>
                    <div className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 2 }}>
                      {r.message}
                    </div>
                    {r.nodeId && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ marginTop: 6 }}
                        onClick={() => actions.selectNode(r.nodeId!)}
                      >
                        <GitBranch size={12} /> {t("changes.inspectNode")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ChangedFileRow({
  file,
  t,
  onSelect,
}: {
  file: ChangedFileImpact;
  t: TFn;
  onSelect: (id: string) => void;
}): ReactNode {
  const target = file.fileNode ?? file.symbols[0];
  const statusLabel = t(`changes.status.${file.status}` as Parameters<TFn>[0]);
  const meta =
    file.symbols.length > 0
      ? file.symbols.map((s) => s.label).slice(0, 4).join(" · ")
      : file.inGraph
        ? humanize(file.fileNode?.type ?? "file")
        : t("changes.unmapped");

  const body = (
    <>
      <span className="tag" style={{ flexShrink: 0 }}>{statusLabel}</span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="mono wrap-anywhere" style={{ display: "block", fontWeight: 600 }} dir="auto">
          {file.path}
        </span>
        {file.oldPath && (
          <span className="mono faint" style={{ fontSize: "var(--fs-xs)", display: "block" }}>
            ← {file.oldPath}
          </span>
        )}
        <span className="muted" style={{ fontSize: "var(--fs-xs)", display: "block", marginTop: 2 }}>
          {meta}
        </span>
      </span>
    </>
  );

  if (target) {
    return (
      <div className="rel" style={{ alignItems: "flex-start" }}>
        <button
          type="button"
          className="row grow"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minWidth: 0, alignItems: "flex-start", textAlign: "left", gap: 8 }}
          onClick={() => onSelect(target.id)}
        >
          {body}
        </button>
      </div>
    );
  }
  return (
    <div className="rel" style={{ alignItems: "flex-start", cursor: "default", gap: 8 }}>
      {body}
    </div>
  );
}

function NodeGroup({
  title,
  icon: Icon,
  nodes,
  onSelect,
}: {
  title: string;
  icon: typeof FileText;
  nodes: KawnNode[];
  onSelect: (id: string) => void;
}): ReactNode {
  if (nodes.length === 0) return null;
  return (
    <section className="card">
      <div className="card-title">
        <Icon size={13} /> {title} ({nodes.length})
      </div>
      <div className="col" style={{ gap: 5 }}>
        {nodes.map((n) => (
          <EntityRow key={n.id} node={n} onClick={() => onSelect(n.id)} />
        ))}
      </div>
    </section>
  );
}
