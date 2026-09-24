import * as vscode from "vscode";
import { BUILTINS, KEYWORDS, TYPES } from "../lexer/Keywords";
import { IndexedMember } from "../project/ProjectIndex";
import { SymbolKind } from "../semantic/SymbolKind";
import { LanguageService } from "./LanguageService";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly service: LanguageService) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    const offset = document.offsetAt(position);
    const beforeCursor = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position),
    );
    const memberAccess = beforeCursor.match(/([A-Za-z_]\w*)\.\w*$/);

    if (memberAccess) {
      return this.memberCompletions(
        document.uri.toString(),
        memberAccess[1],
        offset,
      );
    }

    return this.globalCompletions(document.uri.toString());
  }

  private memberCompletions(
    uri: string,
    variableName: string,
    offset: number,
  ): vscode.CompletionItem[] {
    const typeName = this.service.variableTypeAt(
      uri,
      variableName,
      offset,
    );

    if (!typeName) {
      return [];
    }

    return this.service.project
      .classMembers(typeName)
      .map((member) => this.createMemberCompletion(member));
  }

  private globalCompletions(uri: string): vscode.CompletionItem[] {
    const items = new Map<string, vscode.CompletionItem>();

    const add = (item: vscode.CompletionItem): void => {
      const key =
        typeof item.label === "string"
          ? item.label
          : item.label.label;

      if (!items.has(key)) {
        items.set(key, item);
      }
    };

    for (const keyword of KEYWORDS) {
      add(
        new vscode.CompletionItem(
          keyword,
          vscode.CompletionItemKind.Keyword,
        ),
      );
    }

    for (const type of TYPES) {
      add(
        new vscode.CompletionItem(
          type,
          vscode.CompletionItemKind.TypeParameter,
        ),
      );
    }

    for (const [name, builtin] of BUILTINS) {
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Function,
      );
      item.detail = builtin.signature;
      item.documentation = new vscode.MarkdownString(
        builtin.documentation,
      );
      add(item);
    }

    for (const indexedClass of this.service.project.allClasses()) {
      const item = new vscode.CompletionItem(
        indexedClass.name,
        vscode.CompletionItemKind.Class,
      );
      item.detail = indexedClass.baseClass
        ? "class " +
          indexedClass.name +
          " extends " +
          indexedClass.baseClass
        : "class " + indexedClass.name;
      add(item);
    }

    const file = this.service.project.getFile(uri);
    for (const symbol of file?.symbols ?? []) {
      const item = new vscode.CompletionItem(
        symbol.name,
        this.completionKindForSymbol(symbol.kind),
      );

      if (symbol.typeName) {
        item.detail = symbol.typeName;
      }

      add(item);
    }

    return [...items.values()];
  }

  private createMemberCompletion(
    member: IndexedMember,
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(
      member.name,
      member.kind === "method"
        ? vscode.CompletionItemKind.Method
        : vscode.CompletionItemKind.Field,
    );

    if (member.kind === "method") {
      item.detail =
        "(" +
        member.parameters
          .map(
            (parameter) =>
              parameter.typeName + " " + parameter.name,
          )
          .join(", ") +
        ") : " +
        member.typeName;

      item.insertText = new vscode.SnippetString(
        member.name +
          "(" +
          member.parameters
            .map(
              (parameter, index) =>
                "${" +
                (index + 1) +
                ":" +
                parameter.name +
                "}",
            )
            .join(", ") +
          ")",
      );

      return item;
    }

    item.detail = member.typeName;
    item.insertText = member.name;
    return item;
  }

  private completionKindForSymbol(
    kind: SymbolKind,
  ): vscode.CompletionItemKind {
    switch (kind) {
      case SymbolKind.Class:
        return vscode.CompletionItemKind.Class;
      case SymbolKind.Function:
        return vscode.CompletionItemKind.Function;
      case SymbolKind.Method:
        return vscode.CompletionItemKind.Method;
      case SymbolKind.Field:
        return vscode.CompletionItemKind.Field;
      case SymbolKind.Parameter:
      case SymbolKind.Variable:
        return vscode.CompletionItemKind.Variable;
      case SymbolKind.Enum:
        return vscode.CompletionItemKind.Enum;
    }
  }
}
