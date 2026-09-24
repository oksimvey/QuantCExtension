import { Binder } from "../semantic/Binder";
import { Parser } from "../parser/Parser";
import { TypeChecker } from "../types/TypeChecker";
import { TypeRegistry } from "../types/TypeRegistry";
import { ProjectIndex } from "../project/ProjectIndex";
import { SourceFile } from "../project/SourceFile";
import { QCDiagnostic } from "../types/Diagnostic";

export class LanguageService {
  constructor(readonly project = new ProjectIndex()) {}

  analyse(uri: string, text: string, version = 0): SourceFile {
    const parser = new Parser(text);
    const ast = parser.parseProgram();
    const bound = new Binder().bind(ast);
    const registry = new TypeRegistry();

    for (const indexed of this.project.allClasses()) {
      const file = this.project.getFile(indexed.uri);
      if (!file) continue;
      for (const declaration of file.ast.declarations) {
        if (declaration.kind === "ClassDeclaration") registry.registerClass(declaration);
      }
    }

    const diagnostics: QCDiagnostic[] = [
      ...parser.diagnostics.map(d => ({ ...d, severity: "error" as const, code: "syntax" })),
      ...bound.diagnostics.map(d => ({ ...d, severity: "error" as const, code: "binding" })),
      ...new TypeChecker().check(ast, registry)
    ];

    const file: SourceFile = { uri, text, version, ast, symbols: bound.symbols, diagnostics };
    this.project.update(file);
    return file;
  }

  variableTypeAt(uri: string, name: string, offset: number): string | undefined {
    const file = this.project.getFile(uri);
    if (!file) return undefined;
    const prefix = file.text.slice(0, offset);
    const escaped = name.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
    const re = new RegExp(
      "(?:^|[;{}\\n])\\s*(?:public\\s+|private\\s+|const\\s+|mutable\\s+|local\\s+|global\\s+|constexpr\\s+)*" +
      "([A-Za-z_]\\w*(?:\\s*<[^;=]+>)?)\\s+" + escaped + "\\b", "g"
    );
    let match: RegExpExecArray | null;
    let last: string | undefined;
    while ((match = re.exec(prefix))) last = match[1].replace(/\s*<.*$/, "");
    return last;
  }

  accessTargetAt(uri: string, name: string, offset: number): { typeName: string; access: "static" | "instance" } | undefined {
    if (this.project.getClass(name)) return { typeName: name, access: "static" };
    const typeName = this.variableTypeAt(uri, name, offset);
    return typeName ? { typeName, access: "instance" } : undefined;
  }
}
