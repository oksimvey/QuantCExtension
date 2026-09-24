import * as vscode from "vscode";
import { BUILTINS, KEYWORDS, TYPES } from "../lexer/Keywords";
import { LanguageService } from "./LanguageService";

export class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly service: LanguageService) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const range = document.getWordRangeAtPosition(position);

    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    const markdown = new vscode.MarkdownString();

    if (KEYWORDS.has(word)) {
      markdown.appendCodeblock(word, "qc");
      markdown.appendMarkdown("\nQuantC keyword.");
      return new vscode.Hover(markdown, range);
    }

    if (TYPES.has(word)) {
      markdown.appendCodeblock(word, "qc");
      markdown.appendMarkdown("\nBuilt-in QuantC type.");
      return new vscode.Hover(markdown, range);
    }

    const builtin = BUILTINS.get(word);
    if (builtin) {
      markdown.appendCodeblock(builtin.signature, "qc");
      markdown.appendMarkdown("\n" + builtin.documentation);
      return new vscode.Hover(markdown, range);
    }

    const indexedClass = this.service.project.getClass(word);
    if (indexedClass) {
      markdown.appendCodeblock(
        "class " +
          indexedClass.name +
          (indexedClass.baseClass
            ? " extends " + indexedClass.baseClass
            : ""),
        "qc",
      );
      return new vscode.Hover(markdown, range);
    }

    const file = this.service.project.getFile(
      document.uri.toString(),
    );
    const symbol = file?.symbols.find(
      (candidate) => candidate.name === word,
    );

    if (symbol) {
      markdown.appendCodeblock(
        symbol.typeName
          ? symbol.typeName + " " + symbol.name
          : symbol.name,
        "qc",
      );
      return new vscode.Hover(markdown, range);
    }

    return undefined;
  }
}
