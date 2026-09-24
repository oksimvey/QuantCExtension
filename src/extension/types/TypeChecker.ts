import {
  ClassDeclarationNode,
  FunctionDeclarationNode,
  ProgramNode,
  TypeRef,
  VariableDeclarationNode,
} from "../ast/Nodes";
import { MutabilityType } from "../ast/Modifiers";
import { QCDiagnostic } from "./Diagnostic";
import { TypeRegistry } from "./TypeRegistry";

export class TypeChecker {
  check(program: ProgramNode, registry: TypeRegistry): QCDiagnostic[] {
    const diagnostics: QCDiagnostic[] = [];

    for (const declaration of program.declarations) {
      if (declaration.kind === "ClassDeclaration") {
        registry.registerClass(declaration as ClassDeclarationNode);
      }
    }

    for (const declaration of program.declarations) {
      switch (declaration.kind) {
        case "VariableDeclaration":
          this.checkVariable(
            declaration as VariableDeclarationNode,
            registry,
            diagnostics,
          );
          break;

        case "FunctionDeclaration":
          this.checkFunction(
            declaration as FunctionDeclarationNode,
            registry,
            diagnostics,
          );
          break;

        case "ClassDeclaration":
          this.checkClass(
            declaration as ClassDeclarationNode,
            registry,
            diagnostics,
          );
          break;
      }
    }

    return diagnostics;
  }

  private checkClass(
    declaration: ClassDeclarationNode,
    registry: TypeRegistry,
    diagnostics: QCDiagnostic[],
  ): void {
    if (declaration.baseClass && !registry.has(declaration.baseClass)) {
      diagnostics.push({
        start: declaration.start,
        end: declaration.end,
        message: "Unknown base type '" + declaration.baseClass + "'.",
        severity: "error",
        code: "unknown-base-type",
      });
    }

    for (const member of declaration.members) {
      if (member.kind === "VariableDeclaration") {
        this.checkVariable(
          member as VariableDeclarationNode,
          registry,
          diagnostics,
        );
      } else {
        this.checkFunction(
          member as FunctionDeclarationNode,
          registry,
          diagnostics,
        );
      }
    }
  }

  private checkFunction(
    declaration: FunctionDeclarationNode,
    registry: TypeRegistry,
    diagnostics: QCDiagnostic[],
  ): void {
    this.checkTypeRef(
      declaration.returnType,
      declaration.start,
      declaration.end,
      registry,
      diagnostics,
    );

    for (const parameter of declaration.parameters) {
      this.checkTypeRef(
        parameter.type,
        parameter.start,
        parameter.end,
        registry,
        diagnostics,
      );
    }
  }

  private checkVariable(
    declaration: VariableDeclarationNode,
    registry: TypeRegistry,
    diagnostics: QCDiagnostic[],
  ): void {
    this.checkTypeRef(
      declaration.type,
      declaration.start,
      declaration.end,
      registry,
      diagnostics,
    );

    const requiresInitializer =
      declaration.modifiers.mutability === MutabilityType.Const ||
      declaration.modifiers.mutability === MutabilityType.Constexpr;

    if (requiresInitializer && !declaration.initializer) {
      diagnostics.push({
        start: declaration.start,
        end: declaration.end,
        message:
          declaration.modifiers.mutability +
          " variable '" +
          declaration.name +
          "' must be initialized.",
        severity: "error",
        code: "const-init",
      });
    }
  }

  private checkTypeRef(
    type: TypeRef,
    start: number,
    end: number,
    registry: TypeRegistry,
    diagnostics: QCDiagnostic[],
  ): void {
    if (type.name !== "auto" && !registry.has(type.name)) {
      diagnostics.push({
        start,
        end,
        message: "Unknown type '" + type.name + "'.",
        severity: "error",
        code: "unknown-type",
      });
    }

    for (const genericArgument of type.genericArgs ?? []) {
      this.checkTypeRef(
        genericArgument,
        start,
        end,
        registry,
        diagnostics,
      );
    }
  }
}
