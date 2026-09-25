import * as vscode from "vscode";
import { LanguageService } from "./LanguageService";

const CUSTOM_TYPE_TOKEN = "quantcType";

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  readonly legend = new vscode.SemanticTokensLegend([CUSTOM_TYPE_TOKEN]);

  constructor(private service: LanguageService) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const uri = document.uri.toString();
    const current = this.service.project.getFile(uri);
    if (!current || current.version !== document.version) {
      this.service.analyse(uri, document.getText(), document.version);
    }

    const customTypes = new Set(this.service.project.allClasses().map(type => type.name));
    const builder = new vscode.SemanticTokensBuilder(this.legend);
    if (customTypes.size === 0) return builder.build();

    const text = document.getText();
    let index = 0;

    while (index < text.length) {
      const ch = text[index];
      const next = text[index + 1];

      if (ch === "/" && next === "/") {
        index = this.skipLineComment(text, index + 2);
        continue;
      }

      if (ch === "/" && next === "*") {
        index = this.skipBlockComment(text, index + 2);
        continue;
      }

      if (ch === '"' || ch === "'") {
        index = this.skipQuoted(text, index, ch);
        continue;
      }

      if (this.isIdentifierStart(ch)) {
        const start = index++;
        while (index < text.length && this.isIdentifierPart(text[index])) index++;
        const word = text.slice(start, index);

        if (customTypes.has(word)) {
          builder.push(
            new vscode.Range(document.positionAt(start), document.positionAt(index)),
            CUSTOM_TYPE_TOKEN,
            []
          );
        }
        continue;
      }

      index++;
    }

    return builder.build();
  }

  private skipLineComment(text: string, index: number): number {
    while (index < text.length && text[index] !== "\n") index++;
    return index;
  }

  private skipBlockComment(text: string, index: number): number {
    while (index < text.length) {
      if (text[index] === "*" && text[index + 1] === "/") return index + 2;
      index++;
    }
    return index;
  }

  private skipQuoted(text: string, index: number, quote: string): number {
    index++;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === quote) return index + 1;
      index++;
    }
    return index;
  }

  private isIdentifierStart(ch: string | undefined): boolean {
    return !!ch && /[A-Za-z_]/.test(ch);
  }

  private isIdentifierPart(ch: string | undefined): boolean {
    return !!ch && /[A-Za-z0-9_]/.test(ch);
  }
}
