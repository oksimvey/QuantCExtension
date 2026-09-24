import { ClassDeclarationNode } from "../ast/Nodes";
import { Parser } from "../parser/Parser";
import { ProjectIndex } from "../project/ProjectIndex";
import { SourceFile } from "../project/SourceFile";
import { Binder } from "../semantic/Binder";
import { QCDiagnostic } from "../types/Diagnostic";
import { TypeChecker } from "../types/TypeChecker";
import { TypeRegistry } from "../types/TypeRegistry";
import { escapeRegExp } from "./TextUtils";

export class LanguageService {
  constructor(readonly project = new ProjectIndex()) {}

  analyse(uri: string, text: string, version = 0): SourceFile {
    const parser = new Parser(text);
    const ast = parser.parseProgram();
    const bindResult = new Binder().bind(ast);
    const typeRegistry = this.createTypeRegistry();

    const diagnostics: QCDiagnostic[] = [
      ...parser.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "error" as const,
      })),
      ...bindResult.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        severity: "error" as const,
      })),
      ...new TypeChecker().check(ast, typeRegistry),
    ];

    const file: SourceFile = {
      uri,
      text,
      version,
      ast,
      symbols: bindResult.symbols,
      diagnostics,
    };

    this.project.update(file);
    return file;
  }

  variableTypeAt(
    uri: string,
    variableName: string,
    offset: number,
  ): string | undefined {
    const file = this.project.getFile(uri);

    if (!file) {
      return undefined;
    }

    const prefix = file.text.slice(0, offset);
    const escapedName = escapeRegExp(variableName);
    const declarationPattern = new RegExp(
      "(?:^|[;{}\\n])\\s*" +
        "(?:public\\s+|private\\s+|const\\s+|mutable\\s+|" +
        "local\\s+|global\\s+|constexpr\\s+)*" +
        "([A-Za-z_]\\w*(?:\\s*<[^;=\\n]+>)?)\\s+" +
        escapedName +
        "\\b",
      "g",
    );

    let match: RegExpExecArray | null;
    let lastType: string | undefined;

    while ((match = declarationPattern.exec(prefix))) {
      lastType = match[1].replace(/\s*<.*$/, "");
    }

    return lastType;
  }

  private createTypeRegistry(): TypeRegistry {
    const registry = new TypeRegistry();

    for (const indexedClass of this.project.allClasses()) {
      const file = this.project.getFile(indexedClass.uri);

      if (!file) {
        continue;
      }

      for (const declaration of file.ast.declarations) {
        if (declaration.kind === "ClassDeclaration") {
          registry.registerClass(declaration as ClassDeclarationNode);
        }
      }
    }

    return registry;
  }
}
