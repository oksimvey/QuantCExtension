export type DiagnosticSeverity = "error" | "warning" | "info";

export interface QCDiagnostic {
  start: number;
  end: number;
  message: string;
  severity: DiagnosticSeverity;
  code?: string;
}
