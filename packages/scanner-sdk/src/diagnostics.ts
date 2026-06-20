/** Diagnostic helpers shared by the registry, validation, and plugins. */
import type { DiagnosticLevel, PluginDiagnostic } from "./types";

/** Make a diagnostic with a consistent shape. */
export function diag(level: DiagnosticLevel, message: string, extra?: Partial<PluginDiagnostic>): PluginDiagnostic {
  return { level, message, ...extra };
}

const SEVERITY: Record<DiagnosticLevel, number> = { info: 0, warn: 1, error: 2 };

/** Collects diagnostics in insertion order; deterministic. */
export class DiagnosticCollector {
  private readonly items: PluginDiagnostic[] = [];

  add(d: PluginDiagnostic): void {
    this.items.push(d);
  }

  push(level: DiagnosticLevel, message: string, extra?: Partial<PluginDiagnostic>): void {
    this.items.push(diag(level, message, extra));
  }

  addAll(ds: PluginDiagnostic[]): void {
    for (const d of ds) this.items.push(d);
  }

  all(): PluginDiagnostic[] {
    return [...this.items];
  }

  count(level: DiagnosticLevel): number {
    return this.items.filter((d) => d.level === level).length;
  }

  hasErrors(): boolean {
    return this.items.some((d) => d.level === "error");
  }

  /** highest severity present, or null if empty */
  maxLevel(): DiagnosticLevel | null {
    let max: DiagnosticLevel | null = null;
    for (const d of this.items) {
      if (max === null || SEVERITY[d.level] > SEVERITY[max]) max = d.level;
    }
    return max;
  }
}
