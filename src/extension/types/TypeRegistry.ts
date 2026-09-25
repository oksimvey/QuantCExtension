import { TYPES } from "../lexer/Keywords";
import { ClassDeclarationNode, FunctionDeclarationNode, VariableDeclarationNode } from "../ast/Nodes";
import { StorageType } from "../ast/Modifiers";
import { TypeMember, TypeSymbol } from "./TypeSymbol";

export class TypeRegistry {
  private types = new Map<string, TypeSymbol>();

  constructor() {
    for (const name of TYPES) this.types.set(name, { name, builtin: true, members: new Map() });
  }

  registerClass(c: ClassDeclarationNode): void {
    const type: TypeSymbol = { name: c.name, builtin: false, baseType: c.baseClass, members: new Map() };

    for (const member of c.members) {
      const isGlobal = member.modifiers.storage === StorageType.Global;
      if (member.kind === "FunctionDeclaration") {
        const fn = member as FunctionDeclarationNode;
        type.members.set(fn.name, {
          name: fn.name,
          typeName: fn.returnType.name,
          kind: "method",
          isGlobal,
          visibility: fn.modifiers.visibility,
          mutability: fn.modifiers.mutability,
          declaringType: c.name,
          parameters: fn.parameters.map(p => ({ name: p.name, typeName: p.type.name }))
        });
      } else {
        const field = member as VariableDeclarationNode;
        type.members.set(field.name, {
          name: field.name,
          typeName: field.type.name,
          kind: "field",
          isGlobal,
          visibility: field.modifiers.visibility,
          mutability: field.modifiers.mutability,
          declaringType: c.name
        });
      }
    }

    this.types.set(c.name, type);
  }

  get(name: string): TypeSymbol | undefined { return this.types.get(name); }
  has(name: string): boolean { return this.types.has(name); }
  all(): TypeSymbol[] { return [...this.types.values()]; }

  memberOf(typeName: string, memberName: string): TypeMember | undefined {
    let type = this.get(typeName);
    while (type) {
      const member = type.members.get(memberName);
      if (member) return member;
      type = type.baseType ? this.get(type.baseType) : undefined;
    }
    return undefined;
  }

  membersOf(typeName: string, access: "static" | "instance" | "all" = "all"): TypeMember[] {
    const out: TypeMember[] = [];
    const seen = new Set<string>();
    let type = this.get(typeName);

    while (type) {
      for (const member of type.members.values()) {
        if (seen.has(member.name)) continue;
        if (access === "static" && !member.isGlobal) continue;
        if (access === "instance" && member.isGlobal) continue;
        seen.add(member.name);
        out.push(member);
      }
      type = type.baseType ? this.get(type.baseType) : undefined;
    }

    return out;
  }

  isSubclassOf(typeName: string, baseTypeName: string): boolean {
    let type = this.get(typeName);
    const visited = new Set<string>();

    while (type?.baseType && !visited.has(type.name)) {
      visited.add(type.name);
      if (type.baseType === baseTypeName) return true;
      type = this.get(type.baseType);
    }

    return false;
  }
}
