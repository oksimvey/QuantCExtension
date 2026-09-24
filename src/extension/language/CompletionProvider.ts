import * as vscode from "vscode";
import { BUILTINS, KEYWORDS, TYPES } from "../lexer/Keywords";
import { LanguageService } from "./LanguageService";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private service: LanguageService) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const offset = document.offsetAt(position);
    const before = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const memberMatch = before.match(/([A-Za-z_]\w*)\.\w*$/);

    if (memberMatch) {
      const target = this.service.accessTargetAt(document.uri.toString(), memberMatch[1], offset);
      if (!target) return [];
      return this.service.project.classMembers(target.typeName, target.access).map(member => {
        const item = new vscode.CompletionItem(
          member.name,
          member.kind === "method" ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Field
        );
        const storage = member.isGlobal ? "global" : "instance";
        item.detail = member.kind === "method"
          ? `${storage} • (${member.parameters.map(p => `${p.typeName} ${p.name}`).join(", ")}) : ${member.typeName}`
          : `${storage} • ${member.typeName}`;
        item.insertText = member.kind === "method"
          ? new vscode.SnippetString(member.name + "(" + member.parameters.map((p, i) => "${" + (i + 1) + ":" + p.name + "}").join(", ") + ")")
          : member.name;
        return item;
      });
    }

    const out: vscode.CompletionItem[] = [];
    for (const keyword of KEYWORDS) out.push(new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword));
    for (const type of TYPES) out.push(new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter));
    for (const [name, builtin] of BUILTINS) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = builtin.signature;
      item.documentation = new vscode.MarkdownString(builtin.documentation);
      out.push(item);
    }
    for (const c of this.service.project.allClasses()) {
      const item = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Class);
      item.detail = c.baseClass ? `class ${c.name} extends ${c.baseClass}` : `class ${c.name}`;
      out.push(item);
    }
    return out;
  }
}
