import * as vscode from "vscode";
import { CodeActionProvider } from "./language/CodeActionProvider";
import { CompletionProvider } from "./language/CompletionProvider";
import { DefinitionProvider } from "./language/DefinitionProvider";
import { DiagnosticsProvider } from "./language/DiagnosticsProvider";
import { HoverProvider } from "./language/HoverProvider";
import { LanguageService } from "./language/LanguageService";
import { ReferencesProvider } from "./language/ReferencesProvider";
import { RenameProvider } from "./language/RenameProvider";
import { SignatureHelpProvider } from "./language/SignatureHelpProvider";

const QC_SELECTOR: vscode.DocumentSelector = {
  language: "qc",
  scheme: "file",
};

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const service = new LanguageService();
  const diagnostics = new DiagnosticsProvider(service);

  const analyseDocument = (document: vscode.TextDocument): void => {
    if (document.languageId === "qc") {
      diagnostics.update(document);
    }
  };

  await indexWorkspaceDocuments(analyseDocument);

  for (const document of vscode.workspace.textDocuments) {
    analyseDocument(document);
  }

  context.subscriptions.push(
    diagnostics.collection,
    vscode.workspace.onDidOpenTextDocument(analyseDocument),
    vscode.workspace.onDidChangeTextDocument((event) =>
      analyseDocument(event.document),
    ),
    vscode.workspace.onDidSaveTextDocument(analyseDocument),
    vscode.workspace.onDidDeleteFiles((event) => {
      for (const uri of event.files) {
        diagnostics.remove(uri);
      }
    }),
    vscode.languages.registerCompletionItemProvider(
      QC_SELECTOR,
      new CompletionProvider(service),
      ".",
    ),
    vscode.languages.registerHoverProvider(
      QC_SELECTOR,
      new HoverProvider(service),
    ),
    vscode.languages.registerSignatureHelpProvider(
      QC_SELECTOR,
      new SignatureHelpProvider(service),
      "(",
      ",",
    ),
    vscode.languages.registerDefinitionProvider(
      QC_SELECTOR,
      new DefinitionProvider(service),
    ),
    vscode.languages.registerReferenceProvider(
      QC_SELECTOR,
      new ReferencesProvider(service),
    ),
    vscode.languages.registerRenameProvider(
      QC_SELECTOR,
      new RenameProvider(service),
    ),
    vscode.languages.registerCodeActionsProvider(
      QC_SELECTOR,
      new CodeActionProvider(),
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix,
        ],
      },
    ),
    vscode.commands.registerCommand("qc.compileAndRun", () => {
      const document = vscode.window.activeTextEditor?.document;

      if (!document || document.languageId !== "qc") {
        return vscode.window.showWarningMessage(
          "Open a .qc file first.",
        );
      }

      diagnostics.update(document);
      return vscode.window.showInformationMessage(
        "QuantC semantic analysis completed.",
      );
    }),
  );
}

async function indexWorkspaceDocuments(
  analyseDocument: (document: vscode.TextDocument) => void,
): Promise<void> {
  const files = await vscode.workspace.findFiles(
    "**/*.qc",
    "**/{node_modules,dist,build}/**",
  );

  await Promise.all(
    files.map(async (uri) => {
      const document =
        await vscode.workspace.openTextDocument(uri);
      analyseDocument(document);
    }),
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered by the extension context.
}
