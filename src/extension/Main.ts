import * as vscode from "vscode";
import { LanguageService } from "./language/LanguageService";
import { CompletionProvider } from "./language/CompletionProvider";
import { HoverProvider } from "./language/HoverProvider";
import { DiagnosticsProvider } from "./language/DiagnosticsProvider";
import { SignatureHelpProvider } from "./language/SignatureHelpProvider";
import { DefinitionProvider } from "./language/DefinitionProvider";
import { ReferencesProvider } from "./language/ReferencesProvider";
import { RenameProvider } from "./language/RenameProvider";
import { CodeActionProvider } from "./language/CodeActionProvider";
import { SemanticTokensProvider } from "./language/SemanticTokensProvider";

export async function activate(context: vscode.ExtensionContext) {
  const service = new LanguageService();
  const diagnostics = new DiagnosticsProvider(service);
  const selector: vscode.DocumentSelector = { language: "qc", scheme: "file" };
  const semanticTokens = new SemanticTokensProvider(service);

  const analyse = (document: vscode.TextDocument) => {
    if (document.languageId === "qc") diagnostics.update(document);
  };

  const uris = await vscode.workspace.findFiles("**/*.qc", "**/{node_modules,dist,build}/**");
  const documents = await Promise.all(uris.map(uri => vscode.workspace.openTextDocument(uri)));

  // First pass builds the project index; the second pass resolves cross-file types/members
  // with the complete class registry available.
  for (const document of documents) analyse(document);
  for (const document of documents) analyse(document);

  for (const document of vscode.workspace.textDocuments) analyse(document);

  context.subscriptions.push(
    diagnostics.collection,
    vscode.workspace.onDidOpenTextDocument(analyse),
    vscode.workspace.onDidChangeTextDocument(event => analyse(event.document)),
    vscode.workspace.onDidSaveTextDocument(analyse),
    vscode.workspace.onDidDeleteFiles(event => event.files.forEach(uri => service.project.remove(uri.toString()))),
    vscode.languages.registerCompletionItemProvider(selector, new CompletionProvider(service), "."),
    vscode.languages.registerDocumentSemanticTokensProvider(selector, semanticTokens, semanticTokens.legend),
    vscode.languages.registerHoverProvider(selector, new HoverProvider(service)),
    vscode.languages.registerSignatureHelpProvider(selector, new SignatureHelpProvider(service), "(", ","),
    vscode.languages.registerDefinitionProvider(selector, new DefinitionProvider(service)),
    vscode.languages.registerReferenceProvider(selector, new ReferencesProvider(service)),
    vscode.languages.registerRenameProvider(selector, new RenameProvider(service)),
    vscode.languages.registerCodeActionsProvider(selector, new CodeActionProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }),
    vscode.commands.registerCommand("qc.compileAndRun", () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || document.languageId !== "qc") {
        return vscode.window.showWarningMessage("Open a .qc file first.");
      }
      diagnostics.update(document);
      return vscode.window.showInformationMessage("QuantC semantic analysis completed.");
    })
  );
}

export function deactivate() {}
