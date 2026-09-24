import * as vscode from "vscode";

export class CodeActionProvider
  implements vscode.CodeActionProvider
{
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      const initialize = this.createInitializerFix(
        document,
        diagnostic,
      );

      if (initialize) {
        actions.push(initialize);
      }

      const createClass = this.createUnknownTypeFix(
        document,
        diagnostic,
      );

      if (createClass) {
        actions.push(createClass);
      }
    }

    return actions;
  }

  private createInitializerFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | undefined {
    if (!diagnostic.message.includes("must be initialized")) {
      return undefined;
    }

    const action = new vscode.CodeAction(
      "Initialize with a default value",
      vscode.CodeActionKind.QuickFix,
    );
    const edit = new vscode.WorkspaceEdit();
    const declarationText = document.getText(diagnostic.range);
    const terminator = declarationText.search(/[;\r\n]/);
    const relativeOffset =
      terminator >= 0 ? terminator : declarationText.length;
    const insertionOffset =
      document.offsetAt(diagnostic.range.start) + relativeOffset;

    action.diagnostics = [diagnostic];
    edit.insert(
      document.uri,
      document.positionAt(insertionOffset),
      " = 0",
    );
    action.edit = edit;

    return action;
  }

  private createUnknownTypeFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | undefined {
    if (!diagnostic.message.startsWith("Unknown type")) {
      return undefined;
    }

    const typeName = diagnostic.message.match(/'([^']+)'/)?.[1];

    if (!typeName) {
      return undefined;
    }

    const action = new vscode.CodeAction(
      "Create class '" + typeName + "'",
      vscode.CodeActionKind.QuickFix,
    );
    const edit = new vscode.WorkspaceEdit();

    action.diagnostics = [diagnostic];
    edit.insert(
      document.uri,
      new vscode.Position(document.lineCount, 0),
      "\nclass " + typeName + " {\n}\n",
    );
    action.edit = edit;

    return action;
  }
}
