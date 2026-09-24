import {
  ClassDeclarationNode,
  FunctionDeclarationNode,
  VariableDeclarationNode,
} from "../ast/Nodes";
import { TYPES } from "../lexer/Keywords";
import { TypeMember, TypeSymbol } from "./TypeSymbol";

export class TypeRegistry {
  private readonly types = new Map<string, TypeSymbol>();

  constructor() {
    for (const name of TYPES) {
      this.types.set(name, {
        name,
        builtin: true,
        members: new Map(),
      });
    }
  }

  registerClass(declaration: ClassDeclarationNode): void {
    const type: TypeSymbol = {
      name: declaration.name,
      builtin: false,
      baseType: declaration.baseClass,
      members: new Map(),
    };

    for (const member of declaration.members) {
      if (member.kind === "FunctionDeclaration") {
        const method = member as FunctionDeclarationNode;

        type.members.set(method.name, {
          name: method.name,
          typeName: method.returnType.name,
          kind: "method",
          parameters: method.parameters.map((parameter) => ({
            name: parameter.name,
            typeName: parameter.type.name,
          })),
        });

        continue;
      }

      const field = member as VariableDeclarationNode;
      type.members.set(field.name, {
        name: field.name,
        typeName: field.type.name,
        kind: "field",
      });
    }

    this.types.set(declaration.name, type);
  }

  get(name: string): TypeSymbol | undefined {
    return this.types.get(name);
  }

  has(name: string): boolean {
    return this.types.has(name);
  }

  all(): TypeSymbol[] {
    return [...this.types.values()];
  }

  membersOf(name: string): TypeMember[] {
    const members: TypeMember[] = [];
    const seen = new Set<string>();
    const visitedTypes = new Set<string>();
    let type = this.get(name);

    while (type && !visitedTypes.has(type.name)) {
      visitedTypes.add(type.name);

      for (const member of type.members.values()) {
        if (seen.has(member.name)) {
          continue;
        }

        seen.add(member.name);
        members.push(member);
      }

      type = type.baseType ? this.get(type.baseType) : undefined;
    }

    return members;
  }
}
