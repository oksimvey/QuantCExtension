import { ClassDeclarationNode, FunctionDeclarationNode, ProgramNode, VariableDeclarationNode } from "../ast/Nodes";
import { QCSymbol } from "./Symbol";
import { SymbolKind } from "./SymbolKind";
import { Scope } from "./Scope";

export interface BindResult {
  scope: Scope;
  symbols: QCSymbol[];
  diagnostics: { start: number; end: number; message: string }[];
}

export class Binder {
  bind(program: ProgramNode): BindResult {
    const scope = new Scope();
    const symbols: QCSymbol[] = [];
    const diagnostics: BindResult["diagnostics"] = [];

    const add = (symbol: QCSymbol) => {
      if (!scope.define(symbol)) {
        diagnostics.push({
          start: symbol.declaration.start,
          end: symbol.declaration.end,
          message: `Duplicate declaration '${symbol.name}'.`
        });
      } else {
        symbols.push(symbol);
      }
    };

    for (const declaration of program.declarations) {
      if (declaration.kind === "ImportDeclaration" || declaration.kind === "ExpressionStatement") continue;

      if (declaration.kind === "ClassDeclaration") {
        const c = declaration as ClassDeclarationNode;
        add({ name: c.name, kind: SymbolKind.Class, declaration: c, typeName: c.name });
        for (const member of c.members) {
          symbols.push({
            name: member.name,
            kind: member.kind === "FunctionDeclaration" ? SymbolKind.Method : SymbolKind.Field,
            declaration: member,
            typeName: member.kind === "FunctionDeclaration"
              ? (member as FunctionDeclarationNode).returnType.name
              : (member as VariableDeclarationNode).type.name,
            containerName: c.name
          });
        }
      } else if (declaration.kind === "FunctionDeclaration") {
        const fn = declaration as FunctionDeclarationNode;
        add({ name: fn.name, kind: SymbolKind.Function, declaration: fn, typeName: fn.returnType.name });
        for (const parameter of fn.parameters) {
          symbols.push({
            name: parameter.name,
            kind: SymbolKind.Parameter,
            declaration: parameter,
            typeName: parameter.type.name,
            containerName: fn.name
          });
        }
      } else if (declaration.kind === "VariableDeclaration") {
        const variable = declaration as VariableDeclarationNode;
        add({ name: variable.name, kind: SymbolKind.Variable, declaration: variable, typeName: variable.type.name });
      } else if (declaration.kind === "EnumDeclaration") {
        add({ name: declaration.name, kind: SymbolKind.Enum, declaration, typeName: declaration.name });
      }
    }

    return { scope, symbols, diagnostics };
  }
}
