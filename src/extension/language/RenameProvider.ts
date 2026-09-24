import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";
import {
  findWordOffsets,
  offsetToPosition,
} from "./TextUtils";

export class RenameProvider implements vscode.RenameProvider {
  constructor(private readonly service: LanguageService) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range | undefined {
    return document.getWordRangeAtPosition(position);
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
  ): vscode.WorkspaceEdit | undefined {
    const range = document.getWordRangeAtPosition(position);

    if (!range) {
      return undefined;
    }

    const oldName = document.getText(range);
    const edit = new vscode.WorkspaceEdit();

    for (const file of this.service.project.allFiles()) {
      for (const offset of findWordOffsets(file.text, oldName)) {
        const start = offsetToPosition(file.text, offset);
        const end = offsetToPosition(
          file.text,
          offset + oldName.length,
        );

        edit.replace(
          vscode.Uri.parse(file.uri),
          new vscode.Range(
            start.line,
            start.character,
            end.line,
            end.character,
          ),
          newName,
        );
      }
    }

    return edit;
  }
}
