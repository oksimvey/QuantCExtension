import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";
import {
  findWordOffsets,
  offsetToPosition,
} from "./TextUtils";

export class ReferencesProvider
  implements vscode.ReferenceProvider
{
  constructor(private readonly service: LanguageService) {}

  provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location[] {
    const range = document.getWordRangeAtPosition(position);

    if (!range) {
      return [];
    }

    const word = document.getText(range);
    const locations: vscode.Location[] = [];

    for (const file of this.service.project.allFiles()) {
      for (const offset of findWordOffsets(file.text, word)) {
        const target = offsetToPosition(file.text, offset);

        locations.push(
          new vscode.Location(
            vscode.Uri.parse(file.uri),
            new vscode.Position(target.line, target.character),
          ),
        );
      }
    }

    return locations;
  }
}
