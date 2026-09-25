import { ClassDeclarationNode, FunctionDeclarationNode, ProgramNode, VariableDeclarationNode } from "../ast/Nodes";
import { MutabilityType, StorageType, VisibilityType } from "../ast/Modifiers";
import { SourceFile } from "./SourceFile";

export interface IndexedMember {
  name: string;
  typeName: string;
  kind: "field" | "method";
  isGlobal: boolean;
  visibility: VisibilityType;
  mutability: MutabilityType;
  declaringType: string;
  parameters: { name: string; typeName: string }[];
  start: number;
  end: number;
  uri: string;
}

export interface IndexedClass {
  name: string;
  baseClass?: string;
  members: IndexedMember[];
  start: number;
  end: number;
  uri: string;
}

export class ProjectIndex {
  private files = new Map<string, SourceFile>();
  private classes = new Map<string, IndexedClass>();

  update(file: SourceFile): void {
    this.remove(file.uri);
    this.files.set(file.uri, file);
    this.index(file.uri, file.ast);
  }

  remove(uri: string): void {
    this.files.delete(uri);
    for (const [name, value] of this.classes) {
      if (value.uri === uri) this.classes.delete(name);
    }
  }

  getFile(uri: string): SourceFile | undefined { return this.files.get(uri); }
  allFiles(): SourceFile[] { return [...this.files.values()]; }
  getClass(name: string): IndexedClass | undefined { return this.classes.get(name); }
  allClasses(): IndexedClass[] { return [...this.classes.values()]; }

  classMembers(name: string, access: "static" | "instance" | "all" = "all"): IndexedMember[] {
    const out: IndexedMember[] = [];
    const seen = new Set<string>();
    let current = this.classes.get(name);

    while (current) {
      for (const member of current.members) {
        if (seen.has(member.name)) continue;
        if (access === "static" && !member.isGlobal) continue;
        if (access === "instance" && member.isGlobal) continue;
        seen.add(member.name);
        out.push(member);
      }
      current = current.baseClass ? this.classes.get(current.baseClass) : undefined;
    }

    return out;
  }

  findDeclaration(name: string) {
    for (const c of this.classes.values()) {
      if (c.name === name) return { uri: c.uri, start: c.start, end: c.end };
      const member = this.classMembers(c.name).find(x => x.name === name);
      if (member) return { uri: member.uri, start: member.start, end: member.end };
    }

    for (const file of this.files.values()) {
      const symbol = file.symbols.find(x => x.name === name);
      if (symbol) return { uri: file.uri, start: symbol.declaration.start, end: symbol.declaration.end };
    }

    return undefined;
  }

  private index(uri: string, program: ProgramNode): void {
    for (const declaration of program.declarations) {
      if (declaration.kind !== "ClassDeclaration") continue;
      const c = declaration as ClassDeclarationNode;

      const members: IndexedMember[] = c.members.map(member => {
        const isGlobal = member.modifiers.storage === StorageType.Global;
        if (member.kind === "FunctionDeclaration") {
          const fn = member as FunctionDeclarationNode;
          return {
            name: fn.name,
            typeName: fn.returnType.name,
            kind: "method" as const,
            isGlobal,
            visibility: fn.modifiers.visibility,
            mutability: fn.modifiers.mutability,
            declaringType: c.name,
            parameters: fn.parameters.map(x => ({ name: x.name, typeName: x.type.name })),
            start: fn.start,
            end: fn.end,
            uri
          };
        }

        const field = member as VariableDeclarationNode;
        return {
          name: field.name,
          typeName: field.type.name,
          kind: "field" as const,
          isGlobal,
          visibility: field.modifiers.visibility,
          mutability: field.modifiers.mutability,
          declaringType: c.name,
          parameters: [],
          start: field.start,
          end: field.end,
          uri
        };
      });

      this.classes.set(c.name, {
        name: c.name,
        baseClass: c.baseClass,
        members,
        start: c.start,
        end: c.end,
        uri
      });
    }
  }
}
