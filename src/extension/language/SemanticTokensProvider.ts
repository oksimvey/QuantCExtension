import * as vscode from "vscode";
import { VisibilityType } from "../ast/Modifiers";
import { LanguageService } from "./LanguageService";

const CUSTOM_TYPE_TOKEN = "quantcType";
const CLASS_MEMBER_TOKEN = "quantcMember";

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  readonly legend = new vscode.SemanticTokensLegend([CUSTOM_TYPE_TOKEN, CLASS_MEMBER_TOKEN]);

  constructor(private service: LanguageService) {}

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const uri = document.uri.toString();
    const current = this.service.project.getFile(uri);
    if (!current || current.version !== document.version) {
      this.service.analyse(uri, document.getText(), document.version);
    }

    const customTypes = new Set(this.service.visibleClassesAt(uri).map(type => type.name));
    const builder = new vscode.SemanticTokensBuilder(this.legend);
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
          this.push(builder, document, start, index, CUSTOM_TYPE_TOKEN);
          continue;
        }

        if (this.isAccessibleMember(uri, text, word, start)) {
          this.push(builder, document, start, index, CLASS_MEMBER_TOKEN);
        }
        continue;
      }

      index++;
    }

    return builder.build();
  }

  private isAccessibleMember(uri: string, text: string, memberName: string, memberStart: number): boolean {
    const dot = this.previousNonWhitespace(text, memberStart - 1);
    if (dot < 0 || text[dot] !== ".") return false;

    const objectEnd = this.previousNonWhitespace(text, dot - 1) + 1;
    if (objectEnd <= 0) return false;

    let objectStart = objectEnd;
    while (objectStart > 0 && this.isIdentifierPart(text[objectStart - 1])) objectStart--;
    if (objectStart === objectEnd || !this.isIdentifierStart(text[objectStart])) return false;

    const objectName = text.slice(objectStart, objectEnd);
    const target = this.service.accessTargetAt(uri, objectName, memberStart);
    if (!target) return false;

    const currentClass = this.service.classAt(uri, memberStart)?.name;
    const member = this.service.membersForCompletion(uri, target.typeName, target.access)
      .find(candidate => candidate.name === memberName);
    if (!member) return false;

    return member.visibility === VisibilityType.Public || member.declaringType === currentClass;
  }

  private push(
    builder: vscode.SemanticTokensBuilder,
    document: vscode.TextDocument,
    start: number,
    end: number,
    tokenType: string
  ): void {
    builder.push(
      new vscode.Range(document.positionAt(start), document.positionAt(end)),
      tokenType,
      []
    );
  }

  private previousNonWhitespace(text: string, index: number): number {
    while (index >= 0 && /\s/.test(text[index])) index--;
    return index;
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
