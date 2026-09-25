import {
  AssignmentExpressionNode, BinaryExpressionNode, BlockStatementNode, CallExpressionNode,
  ClassDeclarationNode, ExpressionNode, ExpressionStatementNode, FunctionDeclarationNode,
  IdentifierNode, IfStatementNode, IndexAccessNode, LiteralNode, MemberAccessNode,
  NewExpressionNode, ProgramNode, ReturnStatementNode, StatementNode, UnaryExpressionNode,
  VariableDeclarationNode, WhileStatementNode
} from "../ast/Nodes";
import { MutabilityType, VisibilityType } from "../ast/Modifiers";
import { BUILTINS } from "../lexer/Keywords";
import { QCDiagnostic } from "./Diagnostic";
import { FlowTypeFact } from "../project/SourceFile";
import { TypeRegistry } from "./TypeRegistry";
import { TypeMember } from "./TypeSymbol";

interface CallableInfo {
  parameters: { name: string; typeName: string }[];
  returnType: string;
}

interface ValueInfo {
  typeName: string;
  classReference?: boolean;
  assignable?: boolean;
  readonly?: boolean;
  readonlyName?: string;
  callable?: CallableInfo;
  declaration?: VariableDeclarationNode;
  dynamic?: boolean;
  name?: string;
}

interface CheckContext {
  scopes: Map<string, ValueInfo>[];
  currentClass?: ClassDeclarationNode;
  currentFunction?: FunctionDeclarationNode;
  scopeRanges: { start: number; end: number }[];
}

const INTEGER = new Set(["byte", "short", "int", "long", "ubyte", "ushort", "uint", "ulong", "char"]);
const FLOATING = new Set(["float", "double"]);
const NUMERIC = new Set([...INTEGER, ...FLOATING]);

const INTEGER_RANGES: Record<string, { min: bigint; max: bigint }> = {
  byte: { min: -128n, max: 127n },
  short: { min: -32768n, max: 32767n },
  int: { min: -2147483648n, max: 2147483647n },
  long: { min: -9223372036854775808n, max: 9223372036854775807n },
  ubyte: { min: 0n, max: 255n },
  ushort: { min: 0n, max: 65535n },
  uint: { min: 0n, max: 4294967295n },
  ulong: { min: 0n, max: 18446744073709551615n }
};

const FLOAT_MAX: Record<string, number> = {
  float: 3.4028234663852886e38,
  double: Number.MAX_VALUE
};

export class TypeChecker {
  private diagnostics: QCDiagnostic[] = [];
  private registry!: TypeRegistry;
  private source = "";
  private flowFacts: FlowTypeFact[] = [];

  getFlowFacts(): FlowTypeFact[] { return [...this.flowFacts]; }

  check(program: ProgramNode, registry: TypeRegistry, source = ""): QCDiagnostic[] {
    this.diagnostics = [];
    this.registry = registry;
    this.source = source;
    this.flowFacts = [];

    for (const declaration of program.declarations) {
      if (declaration.kind === "ClassDeclaration") registry.registerClass(declaration as ClassDeclarationNode);
    }

    const root = new Map<string, ValueInfo>();
    for (const declaration of program.declarations) {
      if (declaration.kind === "VariableDeclaration") {
        const variable = declaration as VariableDeclarationNode;
        if (!root.has(variable.name)) {
          root.set(variable.name, {
            typeName: variable.type.name === "auto" ? "unknown" : variable.type.name,
            assignable: true,
            readonly: variable.modifiers.mutability !== MutabilityType.Mutable,
            readonlyName: variable.name,
            declaration: variable,
            dynamic: variable.type.name === "auto",
            name: variable.name
          });
        }
      } else if (declaration.kind === "FunctionDeclaration") {
        const fn = declaration as FunctionDeclarationNode;
        if (!root.has(fn.name)) {
          root.set(fn.name, {
            typeName: fn.returnType.name,
            name: fn.name,
            callable: {
              returnType: fn.returnType.name,
              parameters: fn.parameters.map(p => ({ name: p.name, typeName: p.type.name }))
            }
          });
        }
      }
    }

    const rootContext: CheckContext = {
      scopes: [root],
      scopeRanges: [{ start: program.start, end: program.end }]
    };

    for (const declaration of program.declarations) {
      if (declaration.kind === "ClassDeclaration") {
        this.checkClass(declaration as ClassDeclarationNode, root);
      } else if (declaration.kind === "FunctionDeclaration") {
        this.checkFunction(declaration as FunctionDeclarationNode, rootContext);
      } else if (declaration.kind === "VariableDeclaration") {
        this.checkVariable(declaration as VariableDeclarationNode, rootContext, false);
      } else if (declaration.kind === "ExpressionStatement") {
        this.infer((declaration as ExpressionStatementNode).expression, rootContext);
      }
    }

    return this.diagnostics;
  }

  private checkClass(cls: ClassDeclarationNode, root: Map<string, ValueInfo>): void {
    if (cls.baseClass) this.checkType(cls.baseClass, cls.start, cls.end);

    const classScope = new Map<string, ValueInfo>();
    for (const member of this.registry.membersOf(cls.name)) {
      if (!this.canAccessMember(member, { scopes: [root], currentClass: cls })) continue;

      if (member.kind === "field") {
        classScope.set(member.name, {
          typeName: member.typeName,
          assignable: true,
          readonly: member.mutability !== MutabilityType.Mutable,
          readonlyName: member.name
        });
      } else {
        classScope.set(member.name, {
          typeName: member.typeName,
          callable: {
            returnType: member.typeName,
            parameters: member.parameters ?? []
          }
        });
      }
    }

    for (const member of cls.members) {
      if (member.kind === "VariableDeclaration") {
        this.checkVariable(member as VariableDeclarationNode, {
          scopes: [root, classScope],
          scopeRanges: [{ start: 0, end: cls.end }, { start: cls.start, end: cls.end }],
          currentClass: cls
        }, false);
      } else {
        this.checkFunction(member as FunctionDeclarationNode, {
          scopes: [root, classScope],
          scopeRanges: [{ start: 0, end: cls.end }, { start: cls.start, end: cls.end }],
          currentClass: cls
        });
      }
    }
  }

  private checkFunction(fn: FunctionDeclarationNode, parent: CheckContext): void {
    this.checkType(fn.returnType.name, fn.start, fn.end);
    const functionScope = new Map<string, ValueInfo>();

    for (const parameter of fn.parameters) {
      this.checkType(parameter.type.name, parameter.start, parameter.end);
      if (functionScope.has(parameter.name)) {
        this.error(parameter.start, parameter.end, `Duplicate parameter '${parameter.name}'.`, "duplicate-parameter");
      } else {
        functionScope.set(parameter.name, { typeName: parameter.type.name, assignable: true, name: parameter.name });
      }
    }

    const functionRange = fn.body ? { start: fn.body.start, end: fn.body.end } : { start: fn.start, end: fn.end };
    const context: CheckContext = {
      scopes: [...parent.scopes, functionScope],
      scopeRanges: [...parent.scopeRanges, functionRange],
      currentClass: parent.currentClass,
      currentFunction: fn
    };

    for (const parameter of fn.parameters) {
      this.recordFlow(parameter.name, parameter.type.name, functionRange.start, context, false);
    }

    if (fn.body) this.checkBlock(fn.body, context, false);
  }

  private checkBlock(block: BlockStatementNode, parent: CheckContext, createScope = true): void {
    const context: CheckContext = createScope
      ? {
          ...parent,
          scopes: [...parent.scopes, new Map<string, ValueInfo>()],
          scopeRanges: [...parent.scopeRanges, { start: block.start, end: block.end }]
        }
      : parent;

    for (const statement of block.statements) this.checkStatement(statement, context);
  }

  private checkStatement(statement: StatementNode, context: CheckContext): void {
    switch (statement.kind) {
      case "VariableDeclaration":
        this.checkVariable(statement as VariableDeclarationNode, context, true);
        return;
      case "BlockStatement":
        this.checkBlock(statement as BlockStatementNode, context);
        return;
      case "ExpressionStatement":
        this.infer((statement as ExpressionStatementNode).expression, context);
        return;
      case "ReturnStatement":
        this.checkReturn(statement as ReturnStatementNode, context);
        return;
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

    if (
      (variable.modifiers.mutability === MutabilityType.Const || variable.modifiers.mutability === MutabilityType.Constexpr) &&
      !variable.initializer
    ) {
      this.error(
        variable.start,
        variable.end,
        `${variable.modifiers.mutability} variable '${variable.name}' must be initialized.`,
        "const-init"
      );
    }

    let inferredType = variable.type.name === "auto" ? "unknown" : variable.type.name;
    if (variable.initializer) {
      const value = this.infer(variable.initializer, context);
      if (variable.type.name === "auto") {
        inferredType = value.typeName;
      } else {
        if (!this.isAssignable(variable.type.name, value.typeName)) {
          this.error(
            variable.initializer.start,
            variable.initializer.end,
            `Cannot assign value of type '${value.typeName}' to '${variable.type.name} ${variable.name}'.`,
            "type-mismatch"
          );
        }
        this.checkValueRange(variable.type.name, variable.initializer);
      }
    }

    const info: ValueInfo = {
      typeName: inferredType,
      assignable: true,
      readonly: variable.modifiers.mutability !== MutabilityType.Mutable,
      readonlyName: variable.name,
      declaration: variable,
      dynamic: variable.type.name === "auto",
      name: variable.name
    };

    const scope = context.scopes[context.scopes.length - 1];
    if (define) {
      if (scope.has(variable.name)) {
        this.error(variable.start, variable.end, `Duplicate declaration '${variable.name}'.`, "duplicate-local");
        return;
      }
      scope.set(variable.name, info);
    } else {
      const existing = scope.get(variable.name);
      if (existing) Object.assign(existing, info);
      else scope.set(variable.name, info);
    }

    this.recordFlow(variable.name, inferredType, variable.end, context, variable.type.name === "auto");
  }

  private checkReturn(node: ReturnStatementNode, context: CheckContext): void {
    const expected = context.currentFunction?.returnType.name;
    if (!expected) return;

    if (!node.expression) {
      if (expected !== "void") this.error(node.start, node.end, `Function must return '${expected}'.`, "missing-return-value");
      return;
    }

    const actual = this.infer(node.expression, context).typeName;
    if (expected === "void") {
      this.error(node.expression.start, node.expression.end, "void function cannot return a value.", "void-return-value");
    } else {
      if (!this.isAssignable(expected, actual)) {
        this.error(
          node.expression.start,
          node.expression.end,
          `Return type '${actual}' is not assignable to '${expected}'.`,
          "return-type"
        );
      }
      this.checkValueRange(expected, node.expression);
    }
  }

  private infer(expression: ExpressionNode, context: CheckContext): ValueInfo {
    switch (expression.kind) {
      case "Literal":
        return { typeName: (expression as LiteralNode).literalType };
      case "Identifier":
        return this.inferIdentifier(expression as IdentifierNode, context);
      case "ThisExpression":
        if (!context.currentClass) {
          this.error(expression.start, expression.end, "'this' is only valid inside a class.", "invalid-this");
          return { typeName: "unknown" };
        }
        return { typeName: context.currentClass.name };
      case "SuperExpression":
        if (!context.currentClass?.baseClass) {
          this.error(expression.start, expression.end, "'super' requires a base class.", "invalid-super");
          return { typeName: "unknown" };
        }
        return { typeName: context.currentClass.baseClass };
      case "NewExpression":
        return this.inferNew(expression as NewExpressionNode, context);
      case "MemberAccess":
        return this.inferMember(expression as MemberAccessNode, context);
      case "CallExpression":
        return this.inferCall(expression as CallExpressionNode, context);
      case "AssignmentExpression":
        return this.inferAssignment(expression as AssignmentExpressionNode, context);
      case "BinaryExpression":
        return this.inferBinary(expression as BinaryExpressionNode, context);
      case "UnaryExpression":
        return this.inferUnary(expression as UnaryExpressionNode, context);
      case "IndexAccess": {
        const node = expression as IndexAccessNode;
        this.infer(node.object, context);
        const index = this.infer(node.index, context);
        if (!INTEGER.has(index.typeName) && index.typeName !== "unknown") {
          this.error(node.index.start, node.index.end, `Index must be an integer, got '${index.typeName}'.`, "index-type");
        }
        return { typeName: "unknown", assignable: true };
      }
      default:
        return { typeName: "unknown" };
    }
  }

  private inferIdentifier(node: IdentifierNode, context: CheckContext): ValueInfo {
    const value = this.resolveIdentifier(node.name, context);
    if (value) return value;

    if (this.registry.isVisible(node.name)) return { typeName: node.name, classReference: true, name: node.name };
    if (this.registry.has(node.name)) {
      this.error(node.start, node.end, `Type '${node.name}' is declared in another file but is not imported.`, "missing-import");
      return { typeName: "unknown" };
    }
    if (BUILTINS.has(node.name)) return { typeName: "builtin-function", name: node.name };

    if (node.name !== "<error>") {
      this.error(node.start, node.end, `Unknown identifier '${node.name}'.`, "unknown-identifier");
    }
    return { typeName: "unknown" };
  }

  private resolveIdentifier(name: string, context: CheckContext): ValueInfo | undefined {
    for (let i = context.scopes.length - 1; i >= 0; i--) {
      const value = context.scopes[i].get(name);
      if (value) return value;
    }
    return undefined;
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

    this.checkMemberAccess(member, object, node, context);

    if (member.kind === "method") {
      return {
        typeName: member.typeName,
        callable: {
          returnType: member.typeName,
          parameters: member.parameters ?? []
        }
      };
    }

    return {
      typeName: member.typeName,
      assignable: true,
      readonly: member.mutability !== MutabilityType.Mutable,
      readonlyName: member.name
    };
  }

  private inferCall(node: CallExpressionNode, context: CheckContext): ValueInfo {
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
    if (callee.callable) {
      this.checkArguments(node.args, callee.callable.parameters, context, node.start, node.end);
      return { typeName: callee.callable.returnType };
    }

    node.args.forEach(arg => this.infer(arg, context));
    if (callee.typeName !== "unknown") {
      this.error(node.callee.start, node.callee.end, "Expression is not callable.", "not-callable");
    }
    return { typeName: "unknown" };
  }

  private checkArguments(
    args: ExpressionNode[],
    parameters: { name: string; typeName: string }[],
    context: CheckContext,
    start: number,
    end: number
  ): void {
    if (args.length !== parameters.length) {
      this.error(start, end, `Expected ${parameters.length} argument(s), got ${args.length}.`, "argument-count");
    }

    args.forEach((arg, index) => {
      const actual = this.infer(arg, context).typeName;
      const expected = parameters[index]?.typeName;
      if (expected) {
        if (!this.isAssignable(expected, actual)) {
          this.error(arg.start, arg.end, `Argument ${index + 1} expects '${expected}', got '${actual}'.`, "argument-type");
        }
        this.checkValueRange(expected, arg);
      }
    });
  }

  private inferAssignment(node: AssignmentExpressionNode, context: CheckContext): ValueInfo {
    if (node.target.kind === "Identifier") {
      const identifier = node.target as IdentifierNode;
      const existing = this.resolveIdentifier(identifier.name, context);

      if (!existing && node.operator === "=" && !this.registry.has(identifier.name) && !BUILTINS.has(identifier.name)) {
        const value = this.infer(node.value, context);
        const created: ValueInfo = {
          typeName: value.typeName,
          assignable: true,
          dynamic: true,
          name: identifier.name
        };
        context.scopes[context.scopes.length - 1].set(identifier.name, created);
        this.recordFlow(identifier.name, value.typeName, node.end, context, true);
        return { typeName: value.typeName };
      }
    }

    const target = this.infer(node.target, context);
    const value = this.infer(node.value, context);

    if (!target.assignable) {
      this.error(node.target.start, node.target.end, "Left side of assignment is not assignable.", "not-assignable");
    } else if (target.readonly) {
      this.error(
        node.target.start,
        node.target.end,
        `Cannot assign to readonly '${target.readonlyName ?? "value"}'.`,
        "assign-const"
      );
    }

    if (target.dynamic && node.operator === "=" && !target.readonly) {
      target.typeName = value.typeName;
      if (target.name) this.recordFlow(target.name, value.typeName, node.end, context, true);
      return { typeName: value.typeName };
    }

    if (!this.isAssignable(target.typeName, value.typeName)) {
      this.error(node.value.start, node.value.end, `Cannot assign '${value.typeName}' to '${target.typeName}'.`, "type-mismatch");
    }
    this.checkValueRange(target.typeName, node.value);

    return { typeName: target.typeName };
  }

  private inferBinary(node: BinaryExpressionNode, context: CheckContext): ValueInfo {
    const left = this.infer(node.left, context);
    const right = this.infer(node.right, context);

    if (["and", "or", "&&", "||"].includes(node.operator)) {
      if (left.typeName !== "boolean" && left.typeName !== "unknown") {
        this.error(node.left.start, node.left.end, `Operator '${node.operator}' requires boolean operands.`, "operator-type");
      }
      if (right.typeName !== "boolean" && right.typeName !== "unknown") {
        this.error(node.right.start, node.right.end, `Operator '${node.operator}' requires boolean operands.`, "operator-type");
      }
      return { typeName: "boolean" };
    }

    if (["==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
      if (!this.isAssignable(left.typeName, right.typeName) && !this.isAssignable(right.typeName, left.typeName)) {
        this.error(node.start, node.end, `Cannot compare '${left.typeName}' with '${right.typeName}'.`, "comparison-type");
      }
      return { typeName: "boolean" };
    }

    if (node.operator === "+" && (left.typeName === "string" || right.typeName === "string")) {
      return { typeName: "string" };
    }

    if (!NUMERIC.has(left.typeName) && left.typeName !== "unknown") {
      this.error(node.left.start, node.left.end, `Operator '${node.operator}' requires numeric operands.`, "operator-type");
    }
    if (!NUMERIC.has(right.typeName) && right.typeName !== "unknown") {
      this.error(node.right.start, node.right.end, `Operator '${node.operator}' requires numeric operands.`, "operator-type");
    }

    return { typeName: this.numericResultType(left.typeName, right.typeName) };
  }

  private inferUnary(node: UnaryExpressionNode, context: CheckContext): ValueInfo {
    const operand = this.infer(node.operand, context);

    if (node.operator === "!" || node.operator === "not") {
      if (operand.typeName !== "boolean" && operand.typeName !== "unknown") {
        this.error(node.operand.start, node.operand.end, `Operator '${node.operator}' requires boolean operand.`, "operator-type");
      }
      return { typeName: "boolean" };
    }

    if (!NUMERIC.has(operand.typeName) && operand.typeName !== "unknown") {
      this.error(node.operand.start, node.operand.end, `Operator '${node.operator}' requires numeric operand.`, "operator-type");
    }

    if (node.operator === "++" || node.operator === "--") {
      if (!operand.assignable) {
        this.error(node.operand.start, node.operand.end, `Operator '${node.operator}' requires an assignable operand.`, "not-assignable");
      } else if (operand.readonly) {
        this.error(
          node.operand.start,
          node.operand.end,
          `Cannot modify readonly '${operand.readonlyName ?? "value"}'.`,
          "assign-const"
        );
      }
    }

    return { typeName: operand.typeName };
  }

  private checkMemberAccess(member: TypeMember, object: ValueInfo, node: MemberAccessNode, context: CheckContext): void {
    if (!this.canAccessMember(member, context)) {
      const visibility = member.visibility === VisibilityType.Private ? "private" : "non-public";
      this.error(
        node.memberStart,
        node.memberEnd,
        `Member '${member.name}' is ${visibility} in class '${member.declaringType}'.`,
        "inaccessible-member"
      );
    }

    if (object.classReference && !member.isGlobal) {
      this.error(
        node.memberStart,
        node.memberEnd,
        `Instance member '${node.member}' cannot be accessed through class '${object.typeName}'.`,
        "instance-through-class"
      );
    } else if (!object.classReference && member.isGlobal) {
      this.error(
        node.memberStart,
        node.memberEnd,
        `Global member '${node.member}' must be accessed through class '${object.typeName}'.`,
        "global-through-instance"
      );
    }
  }

  private canAccessMember(member: TypeMember, context: Pick<CheckContext, "currentClass" | "scopes">): boolean {
    return member.visibility === VisibilityType.Public || context.currentClass?.name === member.declaringType;
  }

  private isAssignable(to: string, from: string): boolean {
    if (to === from || from === "unknown" || to === "auto") return true;

    if (from === "null") {
      return !NUMERIC.has(to) && to !== "boolean" && to !== "void";
    }

    if (NUMERIC.has(to) && NUMERIC.has(from)) {
      // Floating-point values cannot silently narrow into integer storage.
      if (INTEGER.has(to) && FLOATING.has(from)) return false;
      return true;
    }

    if (this.registry.isSubclassOf(from, to)) return true;
    return false;
  }

  private numericResultType(left: string, right: string): string {
    if (left === "unknown" || right === "unknown") return "unknown";
    if (left === "double" || right === "double") return "double";
    if (left === "float" || right === "float") return "float";
    if (left === "ulong" || right === "ulong") return "ulong";
    if (left === "long" || right === "long") return "long";
    if (left === "uint" || right === "uint") return "uint";
    return "int";
  }

  private checkValueRange(typeName: string, expression: ExpressionNode): void {
    const integerRange = INTEGER_RANGES[typeName];
    if (integerRange) {
      const value = this.constantIntegerValue(expression);
      if (value !== undefined && (value < integerRange.min || value > integerRange.max)) {
        this.error(
          expression.start,
          expression.end,
          `Value ${value.toString()} is outside the range of '${typeName}' (${integerRange.min.toString()} to ${integerRange.max.toString()}).`,
          "value-out-of-range"
        );
      }
      return;
    }

    const max = FLOAT_MAX[typeName];
    if (max !== undefined) {
      const value = this.constantNumberValue(expression);
      if (value !== undefined && (!Number.isFinite(value) || value < -max || value > max)) {
        this.error(
          expression.start,
          expression.end,
          `Value ${this.sourceText(expression) || String(value)} is outside the finite range of '${typeName}'.`,
          "value-out-of-range"
        );
      }
    }
  }

  private constantIntegerValue(expression: ExpressionNode): bigint | undefined {
    if (expression.kind === "Literal") {
      const literal = expression as LiteralNode;
      if (literal.literalType !== "int") return undefined;
      const raw = this.sourceText(expression);
      if (/^0[xX][0-9A-Fa-f]+$/.test(raw) || /^0[bB][01]+$/.test(raw) || /^\d+$/.test(raw)) {
        try { return BigInt(raw); } catch { return undefined; }
      }
      if (Number.isSafeInteger(literal.value)) return BigInt(literal.value as number);
      return undefined;
    }

    if (expression.kind === "UnaryExpression") {
      const node = expression as UnaryExpressionNode;
      if (node.operator !== "+" && node.operator !== "-") return undefined;
      const operand = this.constantIntegerValue(node.operand);
      if (operand === undefined) return undefined;
      return node.operator === "-" ? -operand : operand;
    }

    if (expression.kind === "BinaryExpression") {
      const node = expression as BinaryExpressionNode;
      const left = this.constantIntegerValue(node.left);
      const right = this.constantIntegerValue(node.right);
      if (left === undefined || right === undefined) return undefined;
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return right === 0n ? undefined : left / right;
        case "%": return right === 0n ? undefined : left % right;
        case "**":
          if (right < 0n || right > 4096n) return undefined;
          return left ** right;
      }
    }

    return undefined;
  }

  private constantNumberValue(expression: ExpressionNode): number | undefined {
    if (expression.kind === "Literal") {
      const value = (expression as LiteralNode).value;
      return typeof value === "number" ? value : undefined;
    }

    if (expression.kind === "UnaryExpression") {
      const node = expression as UnaryExpressionNode;
      const operand = this.constantNumberValue(node.operand);
      if (operand === undefined) return undefined;
      if (node.operator === "+") return operand;
      if (node.operator === "-") return -operand;
      return undefined;
    }

    if (expression.kind === "BinaryExpression") {
      const node = expression as BinaryExpressionNode;
      const left = this.constantNumberValue(node.left);
      const right = this.constantNumberValue(node.right);
      if (left === undefined || right === undefined) return undefined;
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        case "%": return left % right;
        case "**": return left ** right;
      }
    }

    return undefined;
  }

  private sourceText(node: { start: number; end: number }): string {
    return this.source ? this.source.slice(node.start, node.end).trim() : "";
  }

  private checkType(name: string, start: number, end: number): void {
    if (name === "auto") return;
    if (!this.registry.has(name)) {
      this.error(start, end, `Unknown type '${name}'.`, "unknown-type");
      return;
    }
    if (!this.registry.isVisible(name)) {
      this.error(start, end, `Type '${name}' is declared in another file but is not imported.`, "missing-import");
    }
  }

  private recordFlow(name: string, typeName: string, offset: number, context: CheckContext, dynamic: boolean): void {
    const range = context.scopeRanges[context.scopeRanges.length - 1] ?? { start: 0, end: Number.MAX_SAFE_INTEGER };
    this.flowFacts.push({
      name,
      typeName,
      offset,
      scopeStart: range.start,
      scopeEnd: range.end,
      dynamic
    });
  }

  private error(start: number, end: number, message: string, code: string): void {
    this.diagnostics.push({ start, end: Math.max(end, start + 1), message, severity: "error", code });
  }
}
