import { ASTNode } from "./ASTNode";
import { Modifiers } from "./Modifiers";

export interface TypeRef {
  name: string;
  genericArgs?: TypeRef[];
}

export interface ProgramNode extends ASTNode {
  kind: "Program";
  declarations: DeclarationNode[];
}

export type DeclarationNode =
  | VariableDeclarationNode
  | FunctionDeclarationNode
  | ClassDeclarationNode
  | EnumDeclarationNode;

export type ClassMemberNode =
  | VariableDeclarationNode
  | FunctionDeclarationNode;

export interface StatementNode extends ASTNode {
  kind: string;
}

export interface ExpressionNode extends ASTNode {
  kind: string;
  inferredType?: string;
}

export interface VariableDeclarationNode extends StatementNode {
  kind: "VariableDeclaration";
  name: string;
  type: TypeRef;
  initializer?: ExpressionNode;
  modifiers: Modifiers;
}

export interface ParameterNode extends ASTNode {
  kind: "Parameter";
  name: string;
  type: TypeRef;
}

export interface FunctionDeclarationNode extends StatementNode {
  kind: "FunctionDeclaration";
  name: string;
  returnType: TypeRef;
  parameters: ParameterNode[];
  body?: BlockStatementNode;
  modifiers: Modifiers;
}

export interface ClassDeclarationNode extends StatementNode {
  kind: "ClassDeclaration";
  name: string;
  baseClass?: string;
  typeParameters: string[];
  members: ClassMemberNode[];
  modifiers: Modifiers;
}

export interface EnumDeclarationNode extends StatementNode {
  kind: "EnumDeclaration";
  name: string;
  members: string[];
  modifiers: Modifiers;
}

export interface BlockStatementNode extends StatementNode {
  kind: "BlockStatement";
  statements: StatementNode[];
}

export interface IfStatementNode extends StatementNode {
  kind: "IfStatement";
  condition: ExpressionNode;
  thenBranch: StatementNode;
  elseBranch?: StatementNode;
}

export interface WhileStatementNode extends StatementNode {
  kind: "WhileStatement";
  condition: ExpressionNode;
  body: StatementNode;
}

export interface ForStatementNode extends StatementNode {
  kind: "ForStatement";
  body: StatementNode;
}

export interface ReturnStatementNode extends StatementNode {
  kind: "ReturnStatement";
  expression?: ExpressionNode;
}

export interface ExpressionStatementNode extends StatementNode {
  kind: "ExpressionStatement";
  expression: ExpressionNode;
}

export interface IdentifierNode extends ExpressionNode {
  kind: "Identifier";
  name: string;
}

export interface LiteralNode extends ExpressionNode {
  kind: "Literal";
  value: unknown;
  literalType: string;
}

export interface BinaryExpressionNode extends ExpressionNode {
  kind: "BinaryExpression";
  left: ExpressionNode;
  operator: string;
  right: ExpressionNode;
}

export interface UnaryExpressionNode extends ExpressionNode {
  kind: "UnaryExpression";
  operator: string;
  operand: ExpressionNode;
  prefix: boolean;
}

export interface AssignmentExpressionNode extends ExpressionNode {
  kind: "AssignmentExpression";
  target: ExpressionNode;
  operator: string;
  value: ExpressionNode;
}

export interface CallExpressionNode extends ExpressionNode {
  kind: "CallExpression";
  callee: ExpressionNode;
  args: ExpressionNode[];
}

export interface MemberAccessNode extends ExpressionNode {
  kind: "MemberAccess";
  object: ExpressionNode;
  member: string;
}

export interface IndexAccessNode extends ExpressionNode {
  kind: "IndexAccess";
  object: ExpressionNode;
  index: ExpressionNode;
}

export interface NewExpressionNode extends ExpressionNode {
  kind: "NewExpression";
  type: TypeRef;
  args: ExpressionNode[];
}

export interface ThisExpressionNode extends ExpressionNode {
  kind: "ThisExpression";
}

export interface SuperExpressionNode extends ExpressionNode {
  kind: "SuperExpression";
}

export interface CustomOperatorNode extends ExpressionNode {
  kind: "CustomOperator";
  operator: string;
  operands: ExpressionNode[];
}
