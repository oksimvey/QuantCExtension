import {
  AssignmentExpressionNode, BinaryExpressionNode, BlockStatementNode, CallExpressionNode,
  ClassDeclarationNode, ExpressionNode, ExpressionStatementNode, FunctionDeclarationNode,
  IdentifierNode, IfStatementNode, IndexAccessNode, LiteralNode, MemberAccessNode,
  NewExpressionNode, ProgramNode, ReturnStatementNode, StatementNode, UnaryExpressionNode,
  VariableDeclarationNode, WhileStatementNode
} from "../ast/Nodes";
import { MutabilityType } from "../ast/Modifiers";
import { BUILTINS } from "../lexer/Keywords";
import { QCDiagnostic } from "./Diagnostic";
import { TypeRegistry } from "./TypeRegistry";

interface ValueInfo {
  typeName: string;
  classReference?: boolean;
  assignable?: boolean;
  declaration?: VariableDeclarationNode;
}

interface CheckContext {
  scopes: Map<string, ValueInfo>[];
  currentClass?: ClassDeclarationNode;
  currentFunction?: FunctionDeclarationNode;
}

const NUMERIC = new Set(["byte","short","int","long","ubyte","ushort","uint","ulong","float","double","char"]);

function assignmentCompatible(to: string, from: string): boolean {
  if (to === from || from === "unknown" || to === "auto") return true;
  if (from === "null") return !NUMERIC.has(to) && to !== "boolean" && to !== "void";
  return NUMERIC.has(to) && NUMERIC.has(from);
}

export class TypeChecker {
  private diagnostics: QCDiagnostic[] = [];
  private registry!: TypeRegistry;

  check(program: ProgramNode, registry: TypeRegistry): QCDiagnostic[] {
    this.diagnostics = [];
    this.registry = registry;

    for (const declaration of program.declarations) {
      if (declaration.kind === "ClassDeclaration") registry.registerClass(declaration as ClassDeclarationNode);
    }

    const root = new Map<string, ValueInfo>();
    for (const declaration of program.declarations) {
      if (declaration.kind === "VariableDeclaration") {
        const v = declaration as VariableDeclarationNode;
        root.set(v.name, { typeName: v.type.name, assignable: v.modifiers.mutability === MutabilityType.Mutable, declaration: v });
      }
    }

    for (const declaration of program.declarations) {
      if (declaration.kind === "ClassDeclaration") this.checkClass(declaration as ClassDeclarationNode, root);
      else if (declaration.kind === "FunctionDeclaration") this.checkFunction(declaration as FunctionDeclarationNode, { scopes: [root] });
      else if (declaration.kind === "VariableDeclaration") this.checkVariable(declaration as VariableDeclarationNode, { scopes: [root] }, false);
    }

    return this.diagnostics;
  }

  private checkClass(cls: ClassDeclarationNode, root: Map<string, ValueInfo>): void {
    if (cls.baseClass && !this.registry.has(cls.baseClass)) {
      this.error(cls.start, cls.end, `Unknown base class '${cls.baseClass}'.`, "unknown-base-class");
    }

    const classScope = new Map<string, ValueInfo>();
    for (const member of this.registry.membersOf(cls.name, "instance")) {
      if (member.kind === "field") classScope.set(member.name, { typeName: member.typeName, assignable: true });
    }
    for (const member of this.registry.membersOf(cls.name, "static")) {
      if (member.kind === "field") classScope.set(member.name, { typeName: member.typeName, assignable: true });
    }

    for (const member of cls.members) {
      if (member.kind === "VariableDeclaration") {
        this.checkVariable(member as VariableDeclarationNode, { scopes: [root, classScope], currentClass: cls }, false);
      } else {
        this.checkFunction(member as FunctionDeclarationNode, { scopes: [root, classScope], currentClass: cls });
      }
    }
  }

  private checkFunction(fn: FunctionDeclarationNode, parent: CheckContext): void {
    this.checkType(fn.returnType.name, fn.start, fn.end);
    const functionScope = new Map<string, ValueInfo>();

    for (const parameter of fn.parameters) {
      this.checkType(parameter.type.name, parameter.start, parameter.end);
      if (functionScope.has(parameter.name)) this.error(parameter.start, parameter.end, `Duplicate parameter '${parameter.name}'.`, "duplicate-parameter");
      else functionScope.set(parameter.name, { typeName: parameter.type.name, assignable: true });
    }

    const context: CheckContext = {
      scopes: [...parent.scopes, functionScope],
      currentClass: parent.currentClass,
      currentFunction: fn
    };
    if (fn.body) this.checkBlock(fn.body, context, false);
  }

  private checkBlock(block: BlockStatementNode, parent: CheckContext, createScope = true): void {
    const context = createScope ? { ...parent, scopes: [...parent.scopes, new Map<string, ValueInfo>()] } : parent;
    for (const statement of block.statements) this.checkStatement(statement, context);
  }

  private checkStatement(statement: StatementNode, context: CheckContext): void {
    switch (statement.kind) {
      case "VariableDeclaration": this.checkVariable(statement as VariableDeclarationNode, context, true); return;
      case "BlockStatement": this.checkBlock(statement as BlockStatementNode, context); return;
      case "ExpressionStatement": this.infer((statement as ExpressionStatementNode).expression, context); return;
      case "ReturnStatement": this.checkReturn(statement as ReturnStatementNode, context); return;
      case "IfStatement": {
        const node = statement as IfStatementNode;
        const condition = this.infer(node.condition, context);
        if (condition.typeName !== "boolean" && condition.typeName !== "unknown") {
          this.error(node.condition.start, node.condition.end, `if condition must be boolean, got '${condition.typeName}'.`, "condition-type");
        }
        this.checkStatement(node.thenBranch, context);
        if (node.elseBranch) this.checkStatement(node.elseBranch, context);
        return;
      }
      case "WhileStatement": {
        const node = statement as WhileStatementNode;
        const condition = this.infer(node.condition, context);
        if (condition.typeName !== "boolean" && condition.typeName !== "unknown") {
          this.error(node.condition.start, node.condition.end, `while condition must be boolean, got '${condition.typeName}'.`, "condition-type");
        }
        this.checkStatement(node.body, context);
        return;
      }
    }
  }

  private checkVariable(variable: VariableDeclarationNode, context: CheckContext, define: boolean): void {
    this.checkType(variable.type.name, variable.start, variable.end);

    if ((variable.modifiers.mutability === MutabilityType.Const || variable.modifiers.mutability === MutabilityType.Constexpr) && !variable.initializer) {
      this.error(variable.start, variable.end, `${variable.modifiers.mutability} variable '${variable.name}' must be initialized.`, "const-init");
    }

    let inferredType = variable.type.name;
    if (variable.initializer) {
      const value = this.infer(variable.initializer, context);
      if (variable.type.name === "auto") inferredType = value.typeName;
      else if (!assignmentCompatible(variable.type.name, value.typeName)) {
        this.error(variable.initializer.start, variable.initializer.end,
          `Cannot assign value of type '${value.typeName}' to '${variable.type.name} ${variable.name}'.`, "type-mismatch");
      }
    }

    if (!define) return;
    const scope = context.scopes[context.scopes.length - 1];
    if (scope.has(variable.name)) this.error(variable.start, variable.end, `Duplicate declaration '${variable.name}'.`, "duplicate-local");
    else scope.set(variable.name, {
      typeName: inferredType,
      assignable: variable.modifiers.mutability === MutabilityType.Mutable,
      declaration: variable
    });
  }

  private checkReturn(node: ReturnStatementNode, context: CheckContext): void {
    const expected = context.currentFunction?.returnType.name;
    if (!expected) return;
    if (!node.expression) {
      if (expected !== "void") this.error(node.start, node.end, `Function must return '${expected}'.`, "missing-return-value");
      return;
    }

    const actual = this.infer(node.expression, context).typeName;
    if (expected === "void") this.error(node.expression.start, node.expression.end, "void function cannot return a value.", "void-return-value");
    else if (!assignmentCompatible(expected, actual)) {
      this.error(node.expression.start, node.expression.end, `Return type '${actual}' is not assignable to '${expected}'.`, "return-type");
    }
  }

  private infer(expression: ExpressionNode, context: CheckContext): ValueInfo {
    switch (expression.kind) {
      case "Literal": return { typeName: (expression as LiteralNode).literalType };
      case "Identifier": return this.inferIdentifier(expression as IdentifierNode, context);
      case "ThisExpression":
        if (!context.currentClass) { this.error(expression.start, expression.end, "'this' is only valid inside a class.", "invalid-this"); return { typeName: "unknown" }; }
        return { typeName: context.currentClass.name };
      case "SuperExpression":
        if (!context.currentClass?.baseClass) { this.error(expression.start, expression.end, "'super' requires a base class.", "invalid-super"); return { typeName: "unknown" }; }
        return { typeName: context.currentClass.baseClass };
      case "NewExpression": return this.inferNew(expression as NewExpressionNode, context);
      case "MemberAccess": return this.inferMember(expression as MemberAccessNode, context);
      case "CallExpression": return this.inferCall(expression as CallExpressionNode, context);
      case "AssignmentExpression": return this.inferAssignment(expression as AssignmentExpressionNode, context);
      case "BinaryExpression": return this.inferBinary(expression as BinaryExpressionNode, context);
      case "UnaryExpression": return this.inferUnary(expression as UnaryExpressionNode, context);
      case "IndexAccess": {
        const node = expression as IndexAccessNode;
        this.infer(node.object, context);
        const index = this.infer(node.index, context);
        if (!NUMERIC.has(index.typeName) && index.typeName !== "unknown") this.error(node.index.start, node.index.end, `Index must be numeric, got '${index.typeName}'.`, "index-type");
        return { typeName: "unknown", assignable: true };
      }
      default: return { typeName: "unknown" };
    }
  }

  private inferIdentifier(node: IdentifierNode, context: CheckContext): ValueInfo {
    for (let i = context.scopes.length - 1; i >= 0; i--) {
      const value = context.scopes[i].get(node.name);
      if (value) return value;
    }
    if (this.registry.has(node.name)) return { typeName: node.name, classReference: true };
    if (BUILTINS.has(node.name)) return { typeName: "builtin-function" };
    if (node.name !== "<error>") this.error(node.start, node.end, `Unknown identifier '${node.name}'.`, "unknown-identifier");
    return { typeName: "unknown" };
  }

  private inferNew(node: NewExpressionNode, context: CheckContext): ValueInfo {
    this.checkType(node.type.name, node.start, node.end);
    node.args.forEach(arg => this.infer(arg, context));
    return { typeName: node.type.name };
  }

  private inferMember(node: MemberAccessNode, context: CheckContext): ValueInfo {
    const object = this.infer(node.object, context);
    if (object.typeName === "unknown") return { typeName: "unknown" };

    const member = this.registry.memberOf(object.typeName, node.member);
    if (!member) {
      this.error(node.memberStart, node.memberEnd, `Type '${object.typeName}' has no member '${node.member}'.`, "unknown-member");
      return { typeName: "unknown" };
    }

    if (object.classReference && !member.isGlobal) {
      this.error(node.memberStart, node.memberEnd, `Instance member '${node.member}' cannot be accessed through class '${object.typeName}'.`, "instance-through-class");
    } else if (!object.classReference && member.isGlobal) {
      this.error(node.memberStart, node.memberEnd, `Global member '${node.member}' must be accessed through class '${object.typeName}'.`, "global-through-instance");
    }

    return { typeName: member.typeName, assignable: member.kind === "field" };
  }

  private inferCall(node: CallExpressionNode, context: CheckContext): ValueInfo {
    if (node.callee.kind === "MemberAccess") {
      const memberNode = node.callee as MemberAccessNode;
      const object = this.infer(memberNode.object, context);
      const member = this.registry.memberOf(object.typeName, memberNode.member);

      if (!member) {
        this.error(memberNode.memberStart, memberNode.memberEnd, `Type '${object.typeName}' has no member '${memberNode.member}'.`, "unknown-member");
        node.args.forEach(arg => this.infer(arg, context));
        return { typeName: "unknown" };
      }
      if (object.classReference && !member.isGlobal) this.error(memberNode.memberStart, memberNode.memberEnd, `Instance member '${memberNode.member}' cannot be accessed through class '${object.typeName}'.`, "instance-through-class");
      if (!object.classReference && member.isGlobal) this.error(memberNode.memberStart, memberNode.memberEnd, `Global member '${memberNode.member}' must be accessed through class '${object.typeName}'.`, "global-through-instance");
      if (member.kind !== "method") {
        this.error(memberNode.memberStart, memberNode.memberEnd, `Member '${memberNode.member}' is not callable.`, "not-callable");
        node.args.forEach(arg => this.infer(arg, context));
        return { typeName: member.typeName };
      }

      this.checkArguments(node.args, member.parameters ?? [], context, node.start, node.end);
      return { typeName: member.typeName };
    }

    if (node.callee.kind === "Identifier") {
      const name = (node.callee as IdentifierNode).name;
      const builtin = BUILTINS.get(name);
      if (builtin) {
        node.args.forEach(arg => this.infer(arg, context));
        const match = builtin.signature.match(/:\s*([A-Za-z_]\w*)\s*$/);
        return { typeName: match?.[1] ?? "unknown" };
      }
    }

    const callee = this.infer(node.callee, context);
    node.args.forEach(arg => this.infer(arg, context));
    if (callee.typeName !== "unknown") this.error(node.callee.start, node.callee.end, "Expression is not callable.", "not-callable");
    return { typeName: "unknown" };
  }

  private checkArguments(args: ExpressionNode[], parameters: { name: string; typeName: string }[], context: CheckContext, start: number, end: number): void {
    if (args.length !== parameters.length) this.error(start, end, `Expected ${parameters.length} argument(s), got ${args.length}.`, "argument-count");
    args.forEach((arg, index) => {
      const actual = this.infer(arg, context).typeName;
      const expected = parameters[index]?.typeName;
      if (expected && !assignmentCompatible(expected, actual)) this.error(arg.start, arg.end, `Argument ${index + 1} expects '${expected}', got '${actual}'.`, "argument-type");
    });
  }

  private inferAssignment(node: AssignmentExpressionNode, context: CheckContext): ValueInfo {
    const target = this.infer(node.target, context);
    const value = this.infer(node.value, context);
    if (!target.assignable) this.error(node.target.start, node.target.end, "Left side of assignment is not assignable.", "not-assignable");
    if (target.declaration && target.declaration.modifiers.mutability !== MutabilityType.Mutable) {
      this.error(node.target.start, node.target.end, `Cannot assign to ${target.declaration.modifiers.mutability} variable '${target.declaration.name}'.`, "assign-const");
    }
    if (!assignmentCompatible(target.typeName, value.typeName)) this.error(node.value.start, node.value.end, `Cannot assign '${value.typeName}' to '${target.typeName}'.`, "type-mismatch");
    return { typeName: target.typeName };
  }

  private inferBinary(node: BinaryExpressionNode, context: CheckContext): ValueInfo {
    const left = this.infer(node.left, context), right = this.infer(node.right, context);
    if (["and","or","&&","||"].includes(node.operator)) {
      if (left.typeName !== "boolean" && left.typeName !== "unknown") this.error(node.left.start, node.left.end, `Operator '${node.operator}' requires boolean operands.`, "operator-type");
      if (right.typeName !== "boolean" && right.typeName !== "unknown") this.error(node.right.start, node.right.end, `Operator '${node.operator}' requires boolean operands.`, "operator-type");
      return { typeName: "boolean" };
    }
    if (["==","!=","<","<=",">",">="].includes(node.operator)) {
      if (!assignmentCompatible(left.typeName, right.typeName) && !assignmentCompatible(right.typeName, left.typeName)) this.error(node.start, node.end, `Cannot compare '${left.typeName}' with '${right.typeName}'.`, "comparison-type");
      return { typeName: "boolean" };
    }
    if (node.operator === "+" && (left.typeName === "string" || right.typeName === "string")) return { typeName: "string" };
    if (!NUMERIC.has(left.typeName) && left.typeName !== "unknown") this.error(node.left.start, node.left.end, `Operator '${node.operator}' requires numeric operands.`, "operator-type");
    if (!NUMERIC.has(right.typeName) && right.typeName !== "unknown") this.error(node.right.start, node.right.end, `Operator '${node.operator}' requires numeric operands.`, "operator-type");
    return { typeName: left.typeName === "double" || right.typeName === "double" ? "double" : left.typeName };
  }

  private inferUnary(node: UnaryExpressionNode, context: CheckContext): ValueInfo {
    const operand = this.infer(node.operand, context);
    if (node.operator === "!" || node.operator === "not") {
      if (operand.typeName !== "boolean" && operand.typeName !== "unknown") this.error(node.operand.start, node.operand.end, `Operator '${node.operator}' requires boolean operand.`, "operator-type");
      return { typeName: "boolean" };
    }
    if (!NUMERIC.has(operand.typeName) && operand.typeName !== "unknown") this.error(node.operand.start, node.operand.end, `Operator '${node.operator}' requires numeric operand.`, "operator-type");
    return { typeName: operand.typeName };
  }

  private checkType(name: string, start: number, end: number): void {
    if (name !== "auto" && !this.registry.has(name)) this.error(start, end, `Unknown type '${name}'.`, "unknown-type");
  }

  private error(start: number, end: number, message: string, code: string): void {
    this.diagnostics.push({ start, end: Math.max(end, start + 1), message, severity: "error", code });
  }
}
