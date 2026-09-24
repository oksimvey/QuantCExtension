import {
  ClassDeclarationNode,
  FunctionDeclarationNode,
  ProgramNode,
  VariableDeclarationNode,
} from "../ast/Nodes";
import { SourceFile } from "./SourceFile";

export interface IndexedMember {
  name: string;
  typeName: string;
  kind: "field" | "method";
  parameters: Array<{
    name: string;
    typeName: string;
  }>;
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

export interface IndexedDeclaration {
  uri: string;
  start: number;
  end: number;
}

export class ProjectIndex {
  private readonly files = new Map<string, SourceFile>();
  private readonly classes = new Map<string, IndexedClass>();

  update(file: SourceFile): void {
    this.remove(file.uri);
    this.files.set(file.uri, file);
    this.indexProgram(file.uri, file.ast);
  }

  remove(uri: string): void {
    this.files.delete(uri);

    for (const [name, declaration] of this.classes) {
      if (declaration.uri === uri) {
        this.classes.delete(name);
      }
    }
  }

  getFile(uri: string): SourceFile | undefined {
    return this.files.get(uri);
  }

  allFiles(): SourceFile[] {
    return [...this.files.values()];
  }

  getClass(name: string): IndexedClass | undefined {
    return this.classes.get(name);
  }

  allClasses(): IndexedClass[] {
    return [...this.classes.values()];
  }

  classMembers(name: string): IndexedMember[] {
    const members: IndexedMember[] = [];
    const seenMembers = new Set<string>();
    const visitedClasses = new Set<string>();
    let declaration = this.classes.get(name);

    while (declaration && !visitedClasses.has(declaration.name)) {
      visitedClasses.add(declaration.name);

      for (const member of declaration.members) {
        if (seenMembers.has(member.name)) {
          continue;
        }

        seenMembers.add(member.name);
        members.push(member);
      }

      declaration = declaration.baseClass
        ? this.classes.get(declaration.baseClass)
        : undefined;
    }

    return members;
  }

  findDeclaration(name: string): IndexedDeclaration | undefined {
    const classDeclaration = this.classes.get(name);
    if (classDeclaration) {
      return {
        uri: classDeclaration.uri,
        start: classDeclaration.start,
        end: classDeclaration.end,
      };
    }

    for (const classInfo of this.classes.values()) {
      const member = this.classMembers(classInfo.name).find(
        (candidate) => candidate.name === name,
      );

      if (member) {
        return {
          uri: member.uri,
          start: member.start,
          end: member.end,
        };
      }
    }

    for (const file of this.files.values()) {
      const symbol = file.symbols.find(
        (candidate) => candidate.name === name,
      );

      if (symbol) {
        return {
          uri: file.uri,
          start: symbol.declaration.start,
          end: symbol.declaration.end,
        };
      }
    }

    return undefined;
  }

  private indexProgram(uri: string, program: ProgramNode): void {
    for (const declaration of program.declarations) {
      if (declaration.kind !== "ClassDeclaration") {
        continue;
      }

      const classDeclaration = declaration as ClassDeclarationNode;
      const members = classDeclaration.members.map((member) =>
        this.indexMember(uri, member),
      );

      this.classes.set(classDeclaration.name, {
        name: classDeclaration.name,
        baseClass: classDeclaration.baseClass,
        members,
        start: classDeclaration.start,
        end: classDeclaration.end,
        uri,
      });
    }
  }

  private indexMember(
    uri: string,
    member: ClassDeclarationNode["members"][number],
  ): IndexedMember {
    if (member.kind === "FunctionDeclaration") {
      const method = member as FunctionDeclarationNode;

      return {
        name: method.name,
        typeName: method.returnType.name,
        kind: "method",
        parameters: method.parameters.map((parameter) => ({
          name: parameter.name,
          typeName: parameter.type.name,
        })),
        start: method.start,
        end: method.end,
        uri,
      };
    }

    const field = member as VariableDeclarationNode;

    return {
      name: field.name,
      typeName: field.type.name,
      kind: "field",
      parameters: [],
      start: field.start,
      end: field.end,
      uri,
    };
  }
}
