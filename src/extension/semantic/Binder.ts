import {
  ClassDeclarationNode,
  FunctionDeclarationNode,
  ProgramNode,
  VariableDeclarationNode,
} from "../ast/Nodes";
import { Scope } from "./Scope";
import { QCSymbol } from "./Symbol";
import { SymbolKind } from "./SymbolKind";

export interface BindDiagnostic {
  start: number;
  end: number;
  message: string;
}

export interface BindResult {
  scope: Scope;
  symbols: QCSymbol[];
  diagnostics: BindDiagnostic[];
}

export class Binder {
  bind(program: ProgramNode): BindResult {
    const scope = new Scope();
    const symbols: QCSymbol[] = [];
    const diagnostics: BindDiagnostic[] = [];

    const addTopLevelSymbol = (symbol: QCSymbol): void => {
      if (!scope.define(symbol)) {
        diagnostics.push({
          start: symbol.declaration.start,
          end: symbol.declaration.end,
          message: "Duplicate declaration '" + symbol.name + "'.",
        });
        return;
      }

      symbols.push(symbol);
    };

    for (const declaration of program.declarations) {
      switch (declaration.kind) {
        case "ClassDeclaration":
          this.bindClass(
            declaration as ClassDeclarationNode,
            symbols,
            addTopLevelSymbol,
          );
          break;

        case "FunctionDeclaration":
          this.bindFunction(
            declaration as FunctionDeclarationNode,
            symbols,
            addTopLevelSymbol,
          );
          break;

        case "VariableDeclaration": {
          const variable = declaration as VariableDeclarationNode;
          addTopLevelSymbol({
            name: variable.name,
            kind: SymbolKind.Variable,
            declaration: variable,
            typeName: variable.type.name,
          });
          break;
        }

        case "EnumDeclaration":
          addTopLevelSymbol({
            name: declaration.name,
            kind: SymbolKind.Enum,
            declaration,
            typeName: declaration.name,
          });
          break;
      }
    }

    return {
      scope,
      symbols,
      diagnostics,
    };
  }

  private bindClass(
    declaration: ClassDeclarationNode,
    symbols: QCSymbol[],
    addTopLevelSymbol: (symbol: QCSymbol) => void,
  ): void {
    addTopLevelSymbol({
      name: declaration.name,
      kind: SymbolKind.Class,
      declaration,
      typeName: declaration.name,
    });

    for (const member of declaration.members) {
      symbols.push({
        name: member.name,
        kind:
          member.kind === "FunctionDeclaration"
            ? SymbolKind.Method
            : SymbolKind.Field,
        declaration: member,
        typeName:
          member.kind === "FunctionDeclaration"
            ? (member as FunctionDeclarationNode).returnType.name
            : (member as VariableDeclarationNode).type.name,
        containerName: declaration.name,
      });
    }
  }

  private bindFunction(
    declaration: FunctionDeclarationNode,
    symbols: QCSymbol[],
    addTopLevelSymbol: (symbol: QCSymbol) => void,
  ): void {
    addTopLevelSymbol({
      name: declaration.name,
      kind: SymbolKind.Function,
      declaration,
      typeName: declaration.returnType.name,
    });

    for (const parameter of declaration.parameters) {
      symbols.push({
        name: parameter.name,
        kind: SymbolKind.Parameter,
        declaration: parameter,
        typeName: parameter.type.name,
        containerName: declaration.name,
      });
    }
  }
}
