import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";
import { offsetToPosition } from "./TextUtils";

export class DefinitionProvider
  implements vscode.DefinitionProvider
{
  constructor(private readonly service: LanguageService) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const range = document.getWordRangeAtPosition(position);

    if (!range) {
      return undefined;
    }

    const declaration = this.service.project.findDeclaration(
      document.getText(range),
    );

    if (!declaration) {
      return undefined;
    }

    const file = this.service.project.getFile(declaration.uri);

    if (!file) {
      return undefined;
    }

    const target = offsetToPosition(
      file.text,
      declaration.start,
    );

    return new vscode.Location(
      vscode.Uri.parse(declaration.uri),
      new vscode.Position(target.line, target.character),
    );
  }
}
