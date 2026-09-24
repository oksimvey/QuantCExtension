import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

export class DiagnosticsProvider {
  readonly collection =
    vscode.languages.createDiagnosticCollection("quantc");

  constructor(private readonly service: LanguageService) {}

  update(document: vscode.TextDocument): void {
    if (document.languageId !== "qc") {
      return;
    }

    const file = this.service.analyse(
      document.uri.toString(),
      document.getText(),
      document.version,
    );

    const diagnostics = file.diagnostics.map((source) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(
          document.positionAt(source.start),
          document.positionAt(
            Math.max(source.end, source.start + 1),
          ),
        ),
        source.message,
        this.toVscodeSeverity(source.severity),
      );

      diagnostic.code = source.code;
      diagnostic.source = "QuantC";
      return diagnostic;
    });

    this.collection.set(document.uri, diagnostics);
  }

  remove(uri: vscode.Uri): void {
    this.collection.delete(uri);
    this.service.project.remove(uri.toString());
  }

  private toVscodeSeverity(
    severity: "error" | "warning" | "info",
  ): vscode.DiagnosticSeverity {
    switch (severity) {
      case "warning":
        return vscode.DiagnosticSeverity.Warning;
      case "info":
        return vscode.DiagnosticSeverity.Information;
      case "error":
        return vscode.DiagnosticSeverity.Error;
    }
  }
}
