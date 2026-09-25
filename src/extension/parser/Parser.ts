import { Lexer } from "../lexer/Lexer";
import { Token } from "../lexer/Token";
import { TokenStream } from "../lexer/TokenStream";
import { TokenType } from "../lexer/TokenType";
import {
  AssignmentExpressionNode, BinaryExpressionNode, BlockStatementNode, CallExpressionNode,
  ClassDeclarationNode, DeclarationNode, EnumDeclarationNode, ExpressionNode, ExpressionStatementNode,
  FunctionDeclarationNode, IdentifierNode, IfStatementNode, IndexAccessNode, LiteralNode,
  MemberAccessNode, NewExpressionNode, ParameterNode, ProgramNode, ReturnStatementNode,
  StatementNode, TypeRef, UnaryExpressionNode, VariableDeclarationNode, WhileStatementNode
} from "../ast/Nodes";
import { defaultModifiers, Modifiers, MutabilityType, StorageType, VisibilityType } from "../ast/Modifiers";

export interface ParserDiagnostic { start: number; end: number; message: string }

const PRECEDENCE: Record<string, number> = {
  "or": 1, "||": 1, "and": 2, "&&": 2, "==": 3, "!=": 3,
  "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5,
  "*": 6, "/": 6, "%": 6, "**": 7
};

export class Parser {
  private stream: TokenStream;
  readonly diagnostics: ParserDiagnostic[] = [];

  constructor(private source: string) {
    const lexed = new Lexer(source).scan();
    this.stream = new TokenStream(lexed.tokens);
    this.diagnostics.push(...lexed.diagnostics);
  }

  parseProgram(): ProgramNode {
    const declarations: DeclarationNode[] = [];
    this.stream.skipTrivia();
    while (!this.stream.check(TokenType.EOF)) {
      const before = this.stream.peek();
      const declaration = this.declaration();
      if (declaration) declarations.push(declaration);
      else {
        this.err(before, `Expected declaration near '${before.lexeme}'.`);
        this.sync();
      }
      this.stream.skipTrivia();
    }
    return { kind: "Program", start: 0, end: this.source.length, declarations };
  }

  private declaration(): DeclarationNode | null {
    const modifiers = this.modifiers();
    const token = this.stream.peek();
    if (token.lexeme === "class") return this.classDecl(modifiers);
    if (token.lexeme === "enum") return this.enumDecl(modifiers);
    if (token.lexeme === "function") return this.functionDecl(modifiers);
    if (this.looksLikeVariableDeclaration()) return this.variableDecl(modifiers);
    return null;
  }

  private classDecl(modifiers: Modifiers): ClassDeclarationNode {
    const start = this.stream.advance().start;
    const name = this.ident("Expected class name.");
    const typeParameters: string[] = [];
    if (this.stream.match(TokenType.Less)) {
      while (!this.stream.check(TokenType.Greater) && !this.stream.check(TokenType.EOF)) {
        typeParameters.push(this.ident("Expected type parameter."));
        if (!this.stream.match(TokenType.Comma)) break;
      }
      this.expect(TokenType.Greater, "Expected '>' after type parameters.");
    }

    let baseClass: string | undefined;
    if (this.stream.peek().lexeme === "extends") {
      this.stream.advance();
      baseClass = this.ident("Expected base class.");
    }

    const members: (VariableDeclarationNode | FunctionDeclarationNode)[] = [];
    if (!this.stream.match(TokenType.LeftBrace)) {
      this.err(this.stream.peek(), "Expected '{' after class declaration.");
      return { kind: "ClassDeclaration", start, end: this.stream.peek().end, name, baseClass, typeParameters, members, modifiers };
    }

    this.stream.skipTrivia();
    while (!this.stream.check(TokenType.RightBrace) && !this.stream.check(TokenType.EOF)) {
      const memberModifiers = this.modifiers();
      if (this.stream.peek().lexeme === "function") members.push(this.functionDecl(memberModifiers));
      else if (this.looksLikeVariableDeclaration()) members.push(this.variableDecl(memberModifiers));
      else {
        this.err(this.stream.peek(), `Expected class member near '${this.stream.peek().lexeme}'.`);
        this.sync();
      }
      this.stream.skipTrivia();
    }

    const end = this.stream.match(TokenType.RightBrace) ? this.stream.previous().end : this.stream.peek().end;
    return { kind: "ClassDeclaration", start, end, name, baseClass, typeParameters, members, modifiers };
  }

  private enumDecl(modifiers: Modifiers): EnumDeclarationNode {
    const start = this.stream.advance().start;
    const name = this.ident("Expected enum name.");
    const members: string[] = [];
    this.expect(TokenType.LeftBrace, "Expected '{' after enum name.");
    while (!this.stream.check(TokenType.RightBrace) && !this.stream.check(TokenType.EOF)) {
      if (this.stream.peek().type === TokenType.Identifier) members.push(this.stream.advance().lexeme);
      else this.stream.advance();
      this.stream.match(TokenType.Comma);
      this.stream.skipTrivia();
    }
    if (this.stream.check(TokenType.RightBrace)) this.stream.advance();
    return { kind: "EnumDeclaration", start, end: this.stream.previous().end, name, members, modifiers };
  }

  private functionDecl(modifiers: Modifiers): FunctionDeclarationNode {
    const start = this.stream.advance().start;
    const returnType = this.typeRef();
    const name = this.ident("Expected function name.");
    const parameters: ParameterNode[] = [];

    this.expect(TokenType.LeftParen, "Expected '(' after function name.");
    while (!this.stream.check(TokenType.RightParen) && !this.stream.check(TokenType.EOF)) {
      const parameterStart = this.stream.peek().start;
      const type = this.typeRef();
      const parameterName = this.ident("Expected parameter name.");
      parameters.push({ kind: "Parameter", start: parameterStart, end: this.stream.previous().end, name: parameterName, type });
      if (!this.stream.match(TokenType.Comma)) break;
    }
    this.expect(TokenType.RightParen, "Expected ')' after parameters.");

    if (this.stream.check(TokenType.LeftBrace)) {
      const body = this.block();
      return { kind: "FunctionDeclaration", start, end: body.end, name, returnType, parameters, modifiers, body };
    }

    const end = this.consumeTerminator();
    return { kind: "FunctionDeclaration", start, end, name, returnType, parameters, modifiers };
  }

  private variableDecl(modifiers: Modifiers): VariableDeclarationNode {
    const start = this.stream.peek().start;
    const type = this.typeRef();
    const name = this.ident("Expected variable name.");
    let initializer: ExpressionNode | undefined;
    if (this.stream.peek().lexeme === "=") {
      this.stream.advance();
      initializer = this.expression();
    }
    const end = this.consumeTerminator();
    return { kind: "VariableDeclaration", start, end, name, type, initializer, modifiers };
  }

  private block(): BlockStatementNode {
    const open = this.stream.advance();
    const statements: StatementNode[] = [];
    this.stream.skipTrivia();
    while (!this.stream.check(TokenType.RightBrace) && !this.stream.check(TokenType.EOF)) {
      const statement = this.statement();
      if (statement) statements.push(statement);
      else {
        this.err(this.stream.peek(), `Expected statement near '${this.stream.peek().lexeme}'.`);
        this.sync();
      }
      this.stream.skipTrivia();
    }
    const end = this.stream.match(TokenType.RightBrace) ? this.stream.previous().end : this.stream.peek().end;
    return { kind: "BlockStatement", start: open.start, end, statements };
  }

  private statement(): StatementNode | null {
    const token = this.stream.peek();
    if (token.type === TokenType.LeftBrace) return this.block();
    if (token.lexeme === "return") return this.returnStatement();
    if (token.lexeme === "if") return this.ifStatement();
    if (token.lexeme === "while") return this.whileStatement();

    const modifiers = this.modifiers();
    if (this.looksLikeVariableDeclaration()) return this.variableDecl(modifiers);
    if (!this.isDefaultModifiers(modifiers)) {
      this.err(token, "Modifiers are only valid on declarations.");
      return null;
    }

    const expression = this.expression();
    const end = this.consumeTerminator();
    const result: ExpressionStatementNode = { kind: "ExpressionStatement", start: expression.start, end, expression };
    return result;
  }

  private returnStatement(): ReturnStatementNode {
    const start = this.stream.advance().start;
    let expression: ExpressionNode | undefined;
    if (!this.isTerminator(this.stream.peek()) && !this.stream.check(TokenType.RightBrace)) expression = this.expression();
    return { kind: "ReturnStatement", start, end: this.consumeTerminator(), expression };
  }

  private ifStatement(): IfStatementNode {
    const start = this.stream.advance().start;
    this.expect(TokenType.LeftParen, "Expected '(' after if.");
    const condition = this.expression();
    this.expect(TokenType.RightParen, "Expected ')' after condition.");
    const thenBranch = this.statement() ?? { kind: "BlockStatement", start, end: condition.end, statements: [] };
    this.stream.skipTrivia();
    let elseBranch: StatementNode | undefined;
    if (this.stream.peek().lexeme === "else") {
      this.stream.advance();
      elseBranch = this.statement() ?? undefined;
    }
    return { kind: "IfStatement", start, end: elseBranch?.end ?? thenBranch.end, condition, thenBranch, elseBranch };
  }

  private whileStatement(): WhileStatementNode {
    const start = this.stream.advance().start;
    this.expect(TokenType.LeftParen, "Expected '(' after while.");
    const condition = this.expression();
    this.expect(TokenType.RightParen, "Expected ')' after condition.");
    const body = this.statement() ?? { kind: "BlockStatement", start, end: condition.end, statements: [] };
    return { kind: "WhileStatement", start, end: body.end, condition, body };
  }

  private expression(): ExpressionNode {
    return this.assignment();
  }

  private assignment(): ExpressionNode {
    const target = this.binary(1);
    const operator = this.stream.peek().lexeme;
    if (["=", "+=", "-=", "*=", "/="].includes(operator)) {
      this.stream.advance();
      const value = this.assignment();
      const node: AssignmentExpressionNode = { kind: "AssignmentExpression", start: target.start, end: value.end, target, operator, value };
      return node;
    }
    return target;
  }

  private binary(minPrecedence: number): ExpressionNode {
    let left = this.unary();
    for (;;) {
      const operator = this.stream.peek().lexeme;
      const precedence = PRECEDENCE[operator] ?? 0;
      if (precedence < minPrecedence) break;
      this.stream.advance();
      const right = this.binary(precedence + (operator === "**" ? 0 : 1));
      const node: BinaryExpressionNode = { kind: "BinaryExpression", start: left.start, end: right.end, left, operator, right };
      left = node;
    }
    return left;
  }

  private unary(): ExpressionNode {
    const token = this.stream.peek();
    if (["!", "not", "-", "+", "++", "--"].includes(token.lexeme)) {
      this.stream.advance();
      const operand = this.unary();
      const node: UnaryExpressionNode = { kind: "UnaryExpression", start: token.start, end: operand.end, operator: token.lexeme, operand, prefix: true };
      return node;
    }
    return this.postfix();
  }

  private postfix(): ExpressionNode {
    let expression = this.primary();
    for (;;) {
      if (this.stream.match(TokenType.Dot)) {
        const member = this.stream.peek();
        const name = this.ident("Expected member name after '.'.");
        const node: MemberAccessNode = {
          kind: "MemberAccess", start: expression.start, end: member.end,
          object: expression, member: name, memberStart: member.start, memberEnd: member.end
        };
        expression = node;
        continue;
      }

      if (this.stream.match(TokenType.LeftParen)) {
        const args: ExpressionNode[] = [];
        if (!this.stream.check(TokenType.RightParen)) {
          do args.push(this.expression()); while (this.stream.match(TokenType.Comma));
        }
        const close = this.expect(TokenType.RightParen, "Expected ')' after arguments.");
        const node: CallExpressionNode = { kind: "CallExpression", start: expression.start, end: close.end, callee: expression, args };
        expression = node;
        continue;
      }

      if (this.stream.match(TokenType.LeftBracket)) {
        const index = this.expression();
        const close = this.expect(TokenType.RightBracket, "Expected ']' after index.");
        const node: IndexAccessNode = { kind: "IndexAccess", start: expression.start, end: close.end, object: expression, index };
        expression = node;
        continue;
      }
      break;
    }
    return expression;
  }

  private primary(): ExpressionNode {
    const token = this.stream.peek();

    if (token.lexeme === "new") {
      const start = this.stream.advance().start;
      const type = this.typeRef();
      const args: ExpressionNode[] = [];
      let end = this.stream.previous().end;
      if (this.stream.match(TokenType.LeftParen)) {
        if (!this.stream.check(TokenType.RightParen)) do args.push(this.expression()); while (this.stream.match(TokenType.Comma));
        end = this.expect(TokenType.RightParen, "Expected ')' after constructor arguments.").end;
      }
      const node: NewExpressionNode = { kind: "NewExpression", start, end, type, args };
      return node;
    }

    if (token.type === TokenType.Number) {
      this.stream.advance();
      const literalType = token.lexeme.includes(".") ? "double" : "int";
      const node: LiteralNode = { kind: "Literal", start: token.start, end: token.end, value: Number(token.lexeme), literalType };
      return node;
    }

    if (token.type === TokenType.String || token.type === TokenType.Char) {
      this.stream.advance();
      const node: LiteralNode = { kind: "Literal", start: token.start, end: token.end, value: token.lexeme, literalType: token.type === TokenType.String ? "string" : "char" };
      return node;
    }

    if (token.lexeme === "true" || token.lexeme === "false" || token.lexeme === "null") {
      this.stream.advance();
      const node: LiteralNode = { kind: "Literal", start: token.start, end: token.end, value: token.lexeme === "true" ? true : token.lexeme === "false" ? false : null, literalType: token.lexeme === "null" ? "null" : "boolean" };
      return node;
    }

    if (token.lexeme === "this") {
      this.stream.advance();
      return { kind: "ThisExpression", start: token.start, end: token.end };
    }

    if (token.lexeme === "super") {
      this.stream.advance();
      return { kind: "SuperExpression", start: token.start, end: token.end };
    }

    if (this.stream.match(TokenType.LeftParen)) {
      const expression = this.expression();
      this.expect(TokenType.RightParen, "Expected ')' after expression.");
      return expression;
    }

    if (token.type === TokenType.Identifier || token.type === TokenType.Keyword || token.type === TokenType.Type) {
      this.stream.advance();
      const node: IdentifierNode = { kind: "Identifier", start: token.start, end: token.end, name: token.lexeme };
      return node;
    }

    this.err(token, `Expected expression near '${token.lexeme}'.`);
    this.stream.advance();
    return { kind: "Identifier", start: token.start, end: token.end };
  }

  private typeRef(): TypeRef {
    const token = this.stream.peek();
    if (token.type !== TokenType.Type && token.type !== TokenType.Identifier && token.lexeme !== "auto" && token.lexeme !== "void") {
      this.err(token, "Expected type.");
    }
    const name = this.stream.advance().lexeme;
    const args: TypeRef[] = [];
    if (this.stream.match(TokenType.Less)) {
      if (!this.stream.check(TokenType.Greater)) do args.push(this.typeRef()); while (this.stream.match(TokenType.Comma));
      this.expect(TokenType.Greater, "Expected '>' after generic type arguments.");
    }
    return { name, genericArgs: args.length ? args : undefined };
  }

  private modifiers(): Modifiers {
    const modifiers = defaultModifiers();
    for (;;) {
      switch (this.stream.peek().lexeme) {
        case "public": modifiers.visibility = VisibilityType.Public; break;
        case "private": modifiers.visibility = VisibilityType.Private; break;
        case "const": modifiers.mutability = MutabilityType.Const; break;
        case "constexpr": modifiers.mutability = MutabilityType.Constexpr; break;
        case "mutable": modifiers.mutability = MutabilityType.Mutable; break;
        case "global": modifiers.storage = StorageType.Global; break;
        case "local": modifiers.storage = StorageType.Local; break;
        case "abstract": modifiers.abstract = true; break;
        case "override": modifiers.override = true; break;
        case "task": modifiers.task = true; break;
        default: return modifiers;
      }
      this.stream.advance();
    }
  }

  private looksLikeVariableDeclaration(): boolean {
    const first = this.stream.peek();
    if (first.lexeme === "auto" || first.type === TokenType.Type) return true;
    if (first.type !== TokenType.Identifier) return false;
    let n = 1;
    if (this.stream.peek(n).type === TokenType.Less) {
      let depth = 0;
      do {
        const t = this.stream.peek(n++);
        if (t.type === TokenType.Less) depth++;
        else if (t.type === TokenType.Greater) depth--;
        if (t.type === TokenType.EOF) return false;
      } while (depth > 0);
    }
    return this.stream.peek(n).type === TokenType.Identifier;
  }

  private consumeTerminator(): number {
    const end = this.stream.peek().start;
    if (this.stream.match(TokenType.Semicolon, TokenType.NewLine)) return this.stream.previous().end;
    if (!this.stream.check(TokenType.RightBrace) && !this.stream.check(TokenType.EOF)) {
      this.err(this.stream.peek(), "Expected ';' or end of line.");
    }
    return end;
  }

  private isTerminator(token: Token): boolean {
    return token.type === TokenType.Semicolon || token.type === TokenType.NewLine || token.type === TokenType.EOF;
  }

  private isDefaultModifiers(m: Modifiers): boolean {
    return m.visibility === VisibilityType.Default && m.mutability === MutabilityType.Mutable &&
      m.storage === StorageType.Default && !m.abstract && !m.override && !m.task;
  }

  private ident(message: string): string {
    const token = this.stream.peek();
    if (token.type === TokenType.Identifier) {
      this.stream.advance();
      return token.lexeme;
    }
    this.err(token, message);
    this.stream.advance();
    return "<missing>";
  }

  private expect(type: TokenType, message: string): Token {
    if (this.stream.check(type)) return this.stream.advance();
    const token = this.stream.peek();
    this.err(token, message);
    return token;
  }

  private err(token: Token, message: string): void {
    this.diagnostics.push({ start: token.start, end: Math.max(token.end, token.start + 1), message });
  }

  private sync(): void {
    while (!this.stream.check(TokenType.EOF)) {
      if (this.stream.match(TokenType.Semicolon, TokenType.NewLine)) return;
      if (this.stream.check(TokenType.RightBrace)) return;
      this.stream.advance();
    }
  }
}
