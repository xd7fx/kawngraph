/**
 * Bench tab: a read-only viewer for the newest local benchmark report.
 *
 * It deliberately keeps the six benchmark families visually separated so a
 * reader never conflates them: (1) graph construction cost, (A) Context Pack
 * quality, (B) agent behavior, (C) outcome, (D) token usage, and (6) the
 * limitations (failures, notes, small-sample + unverified-auth caveats).
 *
 * Honesty rules (mirrored from the canonical Markdown report and the pure
 * aggregation in lib/bench.ts): a missing number renders as "n/a", NEVER as 0,
 * and neutral/negative findings stay visible — nothing is hidden to flatter the
 * Context Pack.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Coins,
  FileSearch,
  Gauge,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { api, ApiRequestError } from "../api";
import { useT } from "../i18nReact";
import type { MessageKey, TFn } from "../i18n";
import { Empty, Spinner } from "../components/ui";
import { formatInt } from "../lib/format";
import {
  EXPLORATORY_THRESHOLD,
  fmtDelta,
  fmtMetric,
  summarizeBench,
  type BenchGroup,
  type BenchPackRow,
  type BenchSideAgg,
  type BenchSummary,
  type MetricKind,
} from "../lib/bench";
import type { BenchReport, BenchResponse, BenchScanCost } from "../types";

/** A comparable metric row: a label key, its display kind, and an accessor. */
interface Row {
  key: MessageKey;
  kind: MetricKind;
  get: (s: BenchSideAgg) => number | null;
}

// Family B — agent behavior (how the agent searched/read on the way to an answer).
const BEHAVIOR: Row[] = [
  { key: "bench.b.success", kind: "rate", get: (s) => s.successRate },
  { key: "bench.b.kawnCalled", kind: "rate", get: (s) => s.kawnCalledRate },
  { key: "bench.b.kawnFirst", kind: "rate", get: (s) => s.kawnFirstRate },
  { key: "bench.b.toolCalls", kind: "num", get: (s) => s.meanToolCalls },
  { key: "bench.b.distinct", kind: "num", get: (s) => s.meanDistinct },
  { key: "bench.b.irrelevant", kind: "num", get: (s) => s.meanIrrelevant },
  { key: "bench.b.precision", kind: "rate", get: (s) => s.meanPrecision },
  { key: "bench.b.recall", kind: "rate", get: (s) => s.meanRecall },
  { key: "bench.b.ttf", kind: "ms", get: (s) => s.meanTtf },
  { key: "bench.b.wall", kind: "ms", get: (s) => s.meanWall },
];

// Family C — outcome. The edit rows only make sense for e2e tasks.
const OUTCOME_BASE: Row[] = [
  { key: "bench.c.answer", kind: "rate", get: (s) => s.answerCorrectRate },
  { key: "bench.c.tests", kind: "rate", get: (s) => s.testsPassedRate },
];
const OUTCOME_EDIT: Row[] = [
  { key: "bench.c.filesChanged", kind: "num", get: (s) => s.meanFilesChanged },
  { key: "bench.c.outsideGold", kind: "num", get: (s) => s.meanFilesOutsideGold },
  { key: "bench.c.clean", kind: "rate", get: (s) => s.e2eCleanRate },
];

// Family D — token usage (means over ok runs; any missing field shows as n/a).
const TOKENS: Row[] = [
  { key: "bench.tok.input", kind: "tok", get: (s) => s.meanInput },
  { key: "bench.tok.output", kind: "tok", get: (s) => s.meanOutput },
  { key: "bench.tok.cacheRead", kind: "tok", get: (s) => s.meanCacheRead },
  { key: "bench.tok.reasoning", kind: "tok", get: (s) => s.meanReasoning },
];

function groupLabel(g: BenchGroup): string {
  return `${g.projectId} · ${g.taskId} · ${g.agent}`;
}

/** A small uppercase sub-heading inside a family card. */
function SubHead({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        fontSize: "var(--fs-xs)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        fontWeight: 700,
        color: "var(--text-faint)",
        margin: "12px 0 6px",
      }}
    >
      {children}
    </div>
  );
}

/** Without/With/Δ table for one set of metric rows (a = without, b = with). */
function CompareTable({
  rows,
  a,
  b,
  t,
}: {
  rows: Row[];
  a?: BenchSideAgg;
  b?: BenchSideAgg;
  t: TFn;
}): ReactNode {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="dtable">
        <thead>
          <tr>
            <th>{t("bench.metric")}</th>
            <th>{t("bench.without")}</th>
            <th>{t("bench.with")}</th>
            <th>{t("bench.delta")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const av = a ? r.get(a) : null;
            const bv = b ? r.get(b) : null;
            return (
              <tr key={r.key}>
                <td>{t(r.key)}</td>
                <td className="mono">{fmtMetric(r.kind, av)}</td>
                <td className="mono">{fmtMetric(r.kind, bv)}</td>
                <td className="mono">{fmtDelta(r.kind, av, bv)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One project·task·agent group: behavior (B) above outcome (C). */
function GroupCard({ group, t }: { group: BenchGroup; t: TFn }): ReactNode {
  const outcomeRows = group.isE2e ? [...OUTCOME_BASE, ...OUTCOME_EDIT] : OUTCOME_BASE;
  return (
    <section className="card">
      <div className="card-title spread" style={{ display: "flex" }}>
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontWeight: 700 }}>{group.projectId}</span>
          <span className="faint">·</span>
          <span className="mono">{group.taskId}</span>
          <span className="tag">{group.agent}</span>
        </span>
        {group.exploratory && <span className="tag">{t("bench.exploratoryTag")}</span>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <span className="badge">{group.mode}</span>
        {group.model && <span className="badge mono">{group.model}</span>}
        {group.commit && <span className="badge mono">{group.commit.slice(0, 7)}</span>}
      </div>
      <SubHead>{t("bench.behavior")}</SubHead>
      <CompareTable rows={BEHAVIOR} a={group.without} b={group.with} t={t} />
      <SubHead>{t("bench.outcome")}</SubHead>
      <CompareTable rows={outcomeRows} a={group.without} b={group.with} t={t} />
    </section>
  );
}

/** Family 1 — one-time graph construction cost per project. */
function ScanCard({ scanCosts, t }: { scanCosts: BenchScanCost[]; t: TFn }): ReactNode {
  if (scanCosts.length === 0) return null;
  return (
    <section className="card">
      <div className="card-title"><Boxes size={13} /> {t("bench.scanTitle")}</div>
      <p className="muted" style={{ marginTop: 0, fontSize: "var(--fs-sm)" }}>{t("bench.scanHint")}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>{t("bench.scanProject")}</th>
              <th>{t("bench.scanMs")}</th>
              <th>{t("bench.scanNodes")}</th>
              <th>{t("bench.scanEdges")}</th>
              <th>{t("bench.scanFiles")}</th>
            </tr>
          </thead>
          <tbody>
            {scanCosts.map((s) => (
              <tr key={s.projectId}>
                <td className="mono">{s.projectId}</td>
                <td className="mono">{fmtMetric("ms", s.scanMs)}</td>
                <td className="mono">{formatInt(s.nodes)}</td>
                <td className="mono">{formatInt(s.edges)}</td>
                <td className="mono">{formatInt(s.trackedFileCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Family A — deterministic Context Pack quality, one row per project·task. */
function PackCard({ rows, t }: { rows: BenchPackRow[]; t: TFn }): ReactNode {
  if (rows.length === 0) return null;
  return (
    <section className="card">
      <div className="card-title"><FileSearch size={13} /> {t("bench.packTitle")}</div>
      <p className="muted" style={{ marginTop: 0, fontSize: "var(--fs-sm)" }}>{t("bench.packHint")}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="dtable">
          <thead>
            <tr>
              <th>{t("bench.packTask")}</th>
              <th>{t("bench.packPrecision")}</th>
              <th>{t("bench.packRecall")}</th>
              <th>{t("bench.packGold")}</th>
              <th>{t("bench.packMustRead")}</th>
              <th>{t("bench.packTokens")}</th>
              <th>{t("bench.packConfidence")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.pack;
              return (
                <tr key={`${r.projectId} ${r.taskId}`}>
                  <td>
                    <span className="mono" style={{ fontWeight: 700 }}>{r.projectId}</span>
                    <span className="faint"> · </span>
                    <span className="mono">{r.taskId}</span>
                  </td>
                  <td className="mono">{fmtMetric("rate", p.packPrecision)}</td>
                  <td className="mono">{fmtMetric("rate", p.packRecall)}</td>
                  <td className="mono">{p.goldReturned}/{p.goldCount}</td>
                  <td className="mono">{formatInt(p.mustReadCount)}</td>
                  <td className="mono">{formatInt(p.tokenEstimate)}</td>
                  <td className="mono">{fmtMetric("rate", p.confidence)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Family 6 — limitations: exploratory caveat, unverified auth, failures, notes. */
function LimitationsCard({ summary, t }: { summary: BenchSummary; t: TFn }): ReactNode {
  const lim = summary.limitations;
  const nothing =
    !lim.anyExploratory &&
    lim.unverifiedAuth.length === 0 &&
    lim.failures.length === 0 &&
    lim.notes.length === 0;
  return (
    <section className="card">
      <div className="card-title"><ShieldAlert size={13} /> {t("bench.limitsTitle")}</div>
      {nothing && <p className="muted" style={{ marginTop: 0 }}>{t("bench.noLimits")}</p>}

      {lim.anyExploratory && (
        <p className="muted" style={{ marginTop: 0, fontSize: "var(--fs-sm)" }}>
          {t("bench.exploratoryNote", { n: EXPLORATORY_THRESHOLD })}
        </p>
      )}

      {lim.unverifiedAuth.length > 0 && (
        <>
          <SubHead>{t("bench.authTitle")}</SubHead>
          <p className="muted" style={{ marginTop: 0, fontSize: "var(--fs-sm)" }}>{t("bench.authHint")}</p>
          <div className="col" style={{ gap: 4 }}>
            {lim.unverifiedAuth.map((r) => (
              <div key={r.agent} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="tag">{r.agent}</span>
                <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{r.detail}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {lim.failures.length > 0 && (
        <>
          <SubHead>{t("bench.failuresTitle")} ({lim.failures.length})</SubHead>
          <div className="col" style={{ gap: 6 }}>
            {lim.failures.map((f, i) => (
              <div key={i} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="tag">{f.agent}</span>
                <span className="badge mono">{f.condition}</span>
                <span className="mono" style={{ fontSize: "var(--fs-xs)" }}>
                  {f.projectId} · {f.taskId} #{f.repeat}
                </span>
                <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{f.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {lim.notes.length > 0 && (
        <>
          <SubHead>{t("bench.notesTitle")} ({lim.notes.length})</SubHead>
          <ul
            className="muted"
            style={{ margin: 0, paddingInlineStart: 18, fontSize: "var(--fs-sm)" }}
          >
            {lim.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

/** Report metadata + run tally, with a manual refresh (re-reads the newest file). */
function HeaderCard({
  report,
  source,
  summary,
  loading,
  onRefresh,
  t,
}: {
  report: BenchReport;
  source?: string;
  summary: BenchSummary;
  loading: boolean;
  onRefresh: () => void;
  t: TFn;
}): ReactNode {
  return (
    <section className="card">
      <div className="card-title spread" style={{ display: "flex" }}>
        <span className="row" style={{ gap: 6 }}><Gauge size={13} /> {t("bench.title")}</span>
        <button type="button" className="btn btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw size={13} />} {t("bench.refresh")}
        </button>
      </div>
      <dl className="kv">
        {source && (
          <>
            <dt>{t("bench.source")}</dt>
            <dd className="mono">{source}</dd>
          </>
        )}
        <dt>{t("bench.version")}</dt>
        <dd className="mono">{report.kawnVersion}</dd>
        <dt>{t("bench.created")}</dt>
        <dd className="mono">{report.createdAt}</dd>
        <dt>{t("bench.seed")}</dt>
        <dd className="mono">{report.seed}</dd>
        <dt>{t("bench.mode")}</dt>
        <dd>{report.mode}</dd>
        <dt>{t("bench.repeat")}</dt>
        <dd>{report.repeat}</dd>
        <dt>{t("bench.agents")}</dt>
        <dd>{report.agents.join(", ")}</dd>
        <dt>{t("bench.env")}</dt>
        <dd className="mono">{report.env.platform} · node {report.env.node}</dd>
      </dl>
      <div className="row" style={{ marginTop: 8 }}>
        <span className="badge">
          {t("bench.runsSummary", { ok: summary.okRuns, total: summary.totalRuns })}
        </span>
      </div>
    </section>
  );
}

export function BenchView(): ReactNode {
  const t = useT();
  const [data, setData] = useState<BenchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await api.bench(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setData(res);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof ApiRequestError ? err.message : t("bench.errorTitle"));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [t]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void load();
  }, [load]);

  // Cancel any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!data && loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-stack">
        <div className="banner error">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>{t("bench.errorTitle")}</h3>
            <p>{error}</p>
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> {t("bench.refresh")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // No report on disk, or a file that could not be parsed/validated.
  if (!data.ok || !data.report) {
    if (data.reason === "none") {
      return (
        <div className="section-stack">
          <Empty icon={Gauge} title={t("bench.emptyTitle")} hint={t("bench.emptyHint")}>
            <code className="mono" style={{ marginTop: 6 }}>kawn benchmark</code>
          </Empty>
        </div>
      );
    }
    return (
      <div className="section-stack">
        <div className="banner warn">
          <AlertTriangle size={18} className="banner-icon" />
          <div>
            <h3>{t("bench.unreadableTitle")}</h3>
            {data.detail && <p className="mono wrap-anywhere">{data.detail}</p>}
            <button type="button" className="btn" onClick={() => void load()}>
              <RefreshCw size={14} /> {t("bench.refresh")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const report = data.report;
  const summary = summarizeBench(report);

  return (
    <div className="section-stack">
      <HeaderCard
        report={report}
        source={data.source}
        summary={summary}
        loading={loading}
        onRefresh={() => void load()}
        t={t}
      />

      <ScanCard scanCosts={report.scanCosts} t={t} />
      <PackCard rows={summary.packRows} t={t} />

      {summary.groups.length > 0 && (
        <section className="card">
          <div className="card-title"><Activity size={13} /> {t("bench.resultsTitle")}</div>
          <p className="muted" style={{ margin: 0, fontSize: "var(--fs-sm)" }}>{t("bench.resultsHint")}</p>
        </section>
      )}
      {summary.groups.map((g) => <GroupCard key={g.key} group={g} t={t} />)}

      {summary.groups.length > 0 && (
        <section className="card">
          <div className="card-title"><Coins size={13} /> {t("bench.tokensTitle")}</div>
          <p className="muted" style={{ marginTop: 0, fontSize: "var(--fs-sm)" }}>{t("bench.tokensHint")}</p>
          {summary.groups.map((g) => (
            <div key={g.key}>
              <SubHead>{groupLabel(g)}</SubHead>
              <CompareTable rows={TOKENS} a={g.without} b={g.with} t={t} />
            </div>
          ))}
        </section>
      )}

      <LimitationsCard summary={summary} t={t} />
    </div>
  );
}
