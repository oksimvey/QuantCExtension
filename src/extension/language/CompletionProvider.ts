import * as vscode from "vscode";
import { VisibilityType } from "../ast/Modifiers";
import { BUILTINS, KEYWORDS, TYPES } from "../lexer/Keywords";
import { IndexedClass } from "../project/ProjectIndex";
import { LanguageService } from "./LanguageService";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private service: LanguageService) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const uri = document.uri.toString();
    const offset = document.offsetAt(position);
    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const importMatch = linePrefix.match(/^\s*import\s+([A-Za-z0-9_.*]*)$/);

    if (importMatch) return this.importCompletions(document, position, importMatch[1]);

    const before = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const memberMatch = before.match(/([A-Za-z_]\w*)\.\w*$/);

    if (memberMatch) {
      const target = this.service.accessTargetAt(uri, memberMatch[1], offset);
      if (!target) return [];

      const currentClass = this.service.classAt(uri, offset)?.name;
      return this.service.membersForCompletion(uri, target.typeName, target.access)
        .filter(member => member.visibility === VisibilityType.Public || member.declaringType === currentClass)
        .map(member => {
          const item = new vscode.CompletionItem(
            member.name,
            member.kind === "method" ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Field
          );

          const storage = member.isGlobal ? "global" : "instance";
          const visibility = member.visibility === VisibilityType.Public ? "public" : member.visibility;
          item.detail = member.kind === "method"
            ? `${visibility} • ${storage} • (${(member.parameters ?? []).map(p => `${p.typeName} ${p.name}`).join(", ")}) : ${member.typeName}`
            : `${visibility} • ${storage} • ${member.typeName}`;

          item.insertText = member.kind === "method"
            ? new vscode.SnippetString(
              member.name + "(" + (member.parameters ?? []).map((p, i) => "${" + (i + 1) + ":" + p.name + "}").join(", ") + ")"
            )
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

    const visible = new Set(this.service.visibleClassesAt(uri).map(c => c.name));
    for (const cls of this.service.project.allClasses()) {
      const item = new vscode.CompletionItem(cls.name, vscode.CompletionItemKind.Class);
      item.detail = cls.baseClass ? `class ${cls.name} extends ${cls.baseClass}` : `class ${cls.name}`;

      if (cls.uri !== uri && !visible.has(cls.name)) {
        const importPath = this.importPathForClass(document, cls);
        if (importPath) {
          item.detail += ` • auto-import ${importPath}`;
          item.additionalTextEdits = [
            vscode.TextEdit.insert(this.importInsertionPosition(document), `import ${importPath};\n`)
          ];
          item.sortText = `1_${cls.name}`;
        }
      } else {
        item.sortText = `0_${cls.name}`;
      }

      out.push(item);
    }

    return out;
  }

  private importCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    partial: string
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const range = new vscode.Range(
      position.line,
      Math.max(0, position.character - partial.length),
      position.line,
      position.character
    );
    const packages = new Set<string>();

    for (const cls of this.service.project.allClasses()) {
      if (cls.uri === document.uri.toString()) continue;
      const importPath = this.importPathForClass(document, cls);
      if (!importPath) continue;

      const item = new vscode.CompletionItem(importPath, vscode.CompletionItemKind.Class);
      item.detail = `Import class ${cls.name}`;
      item.insertText = importPath;
      item.filterText = importPath;
      item.range = range;
      items.push(item);

      const dot = importPath.lastIndexOf(".");
      if (dot > 0) packages.add(importPath.slice(0, dot) + ".*");
    }

    for (const packageImport of packages) {
      const item = new vscode.CompletionItem(packageImport, vscode.CompletionItemKind.Module);
      item.detail = "Import all classes from this folder";
      item.insertText = packageImport;
      item.filterText = packageImport;
      item.range = range;
      items.push(item);
    }

    return items;
  }

  private importPathForClass(document: vscode.TextDocument, cls: IndexedClass): string | undefined {
    const classUri = vscode.Uri.parse(cls.uri);
    const folder = vscode.workspace.getWorkspaceFolder(classUri) ?? vscode.workspace.getWorkspaceFolder(document.uri);
    let relative: string;

    if (folder) {
      relative = vscode.workspace.asRelativePath(classUri, false);
    } else {
      relative = classUri.path.split("/").pop() ?? "";
    }

    const parts = relative.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length === 0) return cls.name;
    parts.pop();
    return [...parts, cls.name].join(".");
  }

  private importInsertionPosition(document: vscode.TextDocument): vscode.Position {
    let lastImportLine = -1;
    for (let line = 0; line < document.lineCount; line++) {
      if (/^\s*import\s+/.test(document.lineAt(line).text)) lastImportLine = line;
    }
    return new vscode.Position(lastImportLine >= 0 ? lastImportLine + 1 : 0, 0);
  }
}
