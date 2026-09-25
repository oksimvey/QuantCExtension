import { ClassDeclarationNode, ImportDeclarationNode, ProgramNode } from "../ast/Nodes";
import { Binder } from "../semantic/Binder";
import { Parser } from "../parser/Parser";
import { TypeChecker } from "../types/TypeChecker";
import { TypeRegistry } from "../types/TypeRegistry";
import { TypeMember } from "../types/TypeSymbol";
import { IndexedClass, IndexedMember, ProjectIndex } from "../project/ProjectIndex";
import { SourceFile } from "../project/SourceFile";
import { QCDiagnostic } from "../types/Diagnostic";

export class LanguageService {
  constructor(readonly project = new ProjectIndex()) {}

  analyse(uri: string, text: string, version = 0): SourceFile {
    const parser = new Parser(text);
    const ast = parser.parseProgram();
    const bound = new Binder().bind(ast);
    const registry = this.buildRegistry(ast);
    const importDiagnostics = this.resolveImports(ast, registry);
    const checker = new TypeChecker();

    const diagnostics: QCDiagnostic[] = [
      ...parser.diagnostics.map(d => ({ ...d, severity: "error" as const, code: "syntax" })),
      ...bound.diagnostics.map(d => ({ ...d, severity: "error" as const, code: "binding" })),
      ...importDiagnostics,
      ...checker.check(ast, registry, text)
    ];

    const file: SourceFile = {
      uri,
      text,
      version,
      ast,
      symbols: bound.symbols,
      diagnostics,
      flowTypes: checker.getFlowFacts()
    };
    this.project.update(file);
    return file;
  }

  classAt(uri: string, offset: number): ClassDeclarationNode | undefined {
    const file = this.project.getFile(uri);
    if (!file) return undefined;

    return file.ast.declarations.find(
      declaration => declaration.kind === "ClassDeclaration" && offset >= declaration.start && offset <= declaration.end
    ) as ClassDeclarationNode | undefined;
  }

  visibleClassesAt(uri: string): IndexedClass[] {
    const file = this.project.getFile(uri);
    if (!file) return [];

    const visible = new Map<string, IndexedClass>();
    for (const cls of this.project.classesInFile(uri)) visible.set(cls.name, cls);

    for (const declaration of file.ast.declarations) {
      if (declaration.kind !== "ImportDeclaration") continue;
      const imported = declaration as ImportDeclarationNode;
      for (const cls of this.project.resolveImport(imported.path, imported.wildcard)) {
        visible.set(cls.name, cls);
      }
    }

    return [...visible.values()];
  }

  isCustomTypeVisible(uri: string, name: string): boolean {
    return this.visibleClassesAt(uri).some(cls => cls.name === name);
  }

  variableTypeAt(uri: string, name: string, offset: number): string | undefined {
    const file = this.project.getFile(uri);
    if (!file) return undefined;

    const facts = file.flowTypes
      .filter(fact => fact.name === name && fact.offset <= offset && fact.scopeStart <= offset && offset <= fact.scopeEnd)
      .sort((a, b) => {
        if (a.scopeStart !== b.scopeStart) return b.scopeStart - a.scopeStart;
        return b.offset - a.offset;
      });

    if (facts[0] && facts[0].typeName !== "unknown") return facts[0].typeName;

    // Fallback for partially parsed documents while the user is typing.
    const prefix = file.text.slice(0, offset);
    const escaped = name.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
    const re = new RegExp(
      "(?:^|[;{}\\n])\\s*(?:public\\s+|private\\s+|const\\s+|mutable\\s+|local\\s+|global\\s+|constexpr\\s+)*" +
      "([A-Za-z_]\\w*(?:\\s*<[^;=]+>)?)\\s+" + escaped + "\\b", "g"
    );
    let match: RegExpExecArray | null;
    let last: string | undefined;
    while ((match = re.exec(prefix))) last = match[1].replace(/\s*<.*$/, "");
    return last === "auto" ? undefined : last;
  }

  accessTargetAt(uri: string, name: string, offset: number): { typeName: string; access: "static" | "instance" } | undefined {
    const currentClass = this.classAt(uri, offset);

    if (name === "this" && currentClass) {
      return { typeName: currentClass.name, access: "instance" };
    }

    if (name === "super" && currentClass?.baseClass) {
      return { typeName: currentClass.baseClass, access: "instance" };
    }

    if (this.project.getClass(name) && this.isCustomTypeVisible(uri, name)) {
      return { typeName: name, access: "static" };
    }

    const typeName = this.variableTypeAt(uri, name, offset);
    return typeName ? { typeName, access: "instance" } : undefined;
  }

  membersForCompletion(
    uri: string,
    typeName: string,
    access: "static" | "instance" | "all" = "all"
  ): (IndexedMember | TypeMember)[] {
    if (this.project.getClass(typeName)) {
      if (!this.isCustomTypeVisible(uri, typeName)) return [];
      return this.project.classMembers(typeName, access);
    }

    return new TypeRegistry().membersOf(typeName, access);
  }

  importedTypeNames(uri: string): Set<string> {
    const names = new Set<string>();
    const file = this.project.getFile(uri);
    if (!file) return names;

    for (const declaration of file.ast.declarations) {
      if (declaration.kind !== "ImportDeclaration") continue;
      const imported = declaration as ImportDeclarationNode;
      for (const cls of this.project.resolveImport(imported.path, imported.wildcard)) names.add(cls.name);
    }
    return names;
  }

  private buildRegistry(ast: ProgramNode): TypeRegistry {
    const registry = new TypeRegistry();

    // All project classes are available internally for inheritance/member resolution,
    // but remain invisible to source code until imported.
    for (const file of this.project.allFiles()) {
      for (const declaration of file.ast.declarations) {
        if (declaration.kind === "ClassDeclaration") registry.registerClass(declaration, false);
      }
    }

    // Types declared in the current file never require an import.
    for (const declaration of ast.declarations) {
      if (declaration.kind === "ClassDeclaration") registry.registerClass(declaration, true);
    }

    return registry;
  }

  private resolveImports(ast: ProgramNode, registry: TypeRegistry): QCDiagnostic[] {
    const diagnostics: QCDiagnostic[] = [];

    for (const declaration of ast.declarations) {
      if (declaration.kind !== "ImportDeclaration") continue;
      const imported = declaration as ImportDeclarationNode;
      const matches = this.project.resolveImport(imported.path, imported.wildcard);
      const display = imported.path.join(".") + (imported.wildcard ? ".*" : "");

      if (matches.length === 0) {
        diagnostics.push({
          start: imported.start,
          end: imported.end,
          message: `Cannot resolve import '${display}'.`,
          severity: "error",
          code: "unresolved-import"
        });
        continue;
      }

      if (!imported.wildcard && matches.length > 1) {
        diagnostics.push({
          start: imported.start,
          end: imported.end,
          message: `Import '${display}' is ambiguous.`,
          severity: "error",
          code: "ambiguous-import"
        });
        continue;
      }

      for (const match of matches) registry.markVisible(match.name);
    }

    return diagnostics;
  }
}
