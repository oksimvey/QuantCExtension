import {
  ClassDeclarationNode,
  DeclarationNode,
  EnumDeclarationNode,
  FunctionDeclarationNode,
  IdentifierNode,
  ParameterNode,
  ProgramNode,
  TypeRef,
  VariableDeclarationNode,
} from "../ast/Nodes";
import {
  defaultModifiers,
  Modifiers,
  MutabilityType,
  StorageType,
  VisibilityType,
} from "../ast/Modifiers";
import { Lexer } from "../lexer/Lexer";
import { Token } from "../lexer/Token";
import { TokenStream } from "../lexer/TokenStream";
import { TokenType } from "../lexer/TokenType";

export interface ParserDiagnostic {
  start: number;
  end: number;
  message: string;
}

export class Parser {
  private readonly stream: TokenStream;
  readonly diagnostics: ParserDiagnostic[] = [];

  constructor(private readonly source: string) {
    const lexerResult = new Lexer(source).scan();
    this.stream = new TokenStream(lexerResult.tokens);
    this.diagnostics.push(...lexerResult.diagnostics);
  }

  parseProgram(): ProgramNode {
    const declarations: DeclarationNode[] = [];

    this.stream.skipTrivia();

    while (!this.stream.check(TokenType.EOF)) {
      const token = this.stream.peek();
      const declaration = this.parseDeclaration();

      if (declaration) {
        declarations.push(declaration);
      } else {
        this.reportError(
          token,
          "Expected declaration near '" + token.lexeme + "'.",
        );
        this.synchronize();
      }

      this.stream.skipTrivia();
    }

    return {
      kind: "Program",
      start: 0,
      end: this.source.length,
      declarations,
    };
  }

  private parseDeclaration(): DeclarationNode | null {
    const modifiers = this.parseModifiers();
    const token = this.stream.peek();

    if (token.lexeme === "class") {
      return this.parseClassDeclaration(modifiers);
    }

    if (token.lexeme === "enum") {
      return this.parseEnumDeclaration(modifiers);
    }

    if (token.lexeme === "function") {
      return this.parseFunctionDeclaration(modifiers);
    }

    if (this.isTypeLike(token)) {
      return this.parseVariableDeclaration(modifiers);
    }

    return null;
  }

  private parseClassDeclaration(modifiers: Modifiers): ClassDeclarationNode {
    const start = this.stream.advance().start;
    const name = this.consumeIdentifier("Expected class name.");
    const typeParameters = this.parseTypeParameters();

    let baseClass: string | undefined;
    if (this.stream.peek().lexeme === "extends") {
      this.stream.advance();
      baseClass = this.consumeIdentifier("Expected base class.");
    }

    const members: ClassDeclarationNode["members"] = [];

    if (!this.stream.match(TokenType.LeftBrace)) {
      this.reportError(this.stream.peek(), "Expected '{'.");

      return {
        kind: "ClassDeclaration",
        start,
        end: this.stream.peek().end,
        name,
        baseClass,
        typeParameters,
        members,
        modifiers,
      };
    }

    this.stream.skipTrivia();

    while (
      !this.stream.check(TokenType.RightBrace) &&
      !this.stream.check(TokenType.EOF)
    ) {
      const memberModifiers = this.parseModifiers();
      const token = this.stream.peek();

      if (token.lexeme === "function") {
        members.push(this.parseFunctionDeclaration(memberModifiers));
      } else if (this.isTypeLike(token)) {
        members.push(this.parseVariableDeclaration(memberModifiers));
      } else {
        this.reportError(
          token,
          "Expected class member near '" + token.lexeme + "'.",
        );
        this.synchronize();
      }

      this.stream.skipTrivia();
    }

    const end = this.stream.match(TokenType.RightBrace)
      ? this.stream.previous().end
      : this.stream.peek().end;

    return {
      kind: "ClassDeclaration",
      start,
      end,
      name,
      baseClass,
      typeParameters,
      members,
      modifiers,
    };
  }

  private parseTypeParameters(): string[] {
    const typeParameters: string[] = [];

    if (!this.stream.match(TokenType.Less)) {
      return typeParameters;
    }

    while (
      !this.stream.check(TokenType.Greater) &&
      !this.stream.check(TokenType.EOF)
    ) {
      typeParameters.push(
        this.consumeIdentifier("Expected type parameter."),
      );

      if (!this.stream.match(TokenType.Comma)) {
        break;
      }
    }

    if (!this.stream.match(TokenType.Greater)) {
      this.reportError(this.stream.peek(), "Expected '>'.");
    }

    return typeParameters;
  }

  private parseEnumDeclaration(modifiers: Modifiers): EnumDeclarationNode {
    const start = this.stream.advance().start;
    const name = this.consumeIdentifier("Expected enum name.");
    const members: string[] = [];

    if (!this.stream.match(TokenType.LeftBrace)) {
      this.reportError(this.stream.peek(), "Expected '{'.");
    }

    this.stream.skipTrivia();

    while (
      !this.stream.check(TokenType.RightBrace) &&
      !this.stream.check(TokenType.EOF)
    ) {
      const token = this.stream.peek();

      if (token.type === TokenType.Identifier) {
        members.push(this.stream.advance().lexeme);
      } else {
        this.reportError(token, "Expected enum member.");
        this.stream.advance();
      }

      this.stream.match(TokenType.Comma);
      this.stream.skipTrivia();
    }

    if (this.stream.check(TokenType.RightBrace)) {
      this.stream.advance();
    }

    return {
      kind: "EnumDeclaration",
      start,
      end: this.stream.previous().end,
      name,
      members,
      modifiers,
    };
  }

  private parseFunctionDeclaration(
    modifiers: Modifiers,
  ): FunctionDeclarationNode {
    const start = this.stream.advance().start;
    const returnType = this.parseTypeRef();
    const name = this.consumeIdentifier("Expected function name.");
    const parameters = this.parseParameters();
    const bodyStart = this.stream.peek().start;

    if (!this.stream.match(TokenType.LeftBrace)) {
      return {
        kind: "FunctionDeclaration",
        start,
        end: this.stream.peek().end,
        name,
        returnType,
        parameters,
        modifiers,
      };
    }

    const bodyEnd = this.skipBlock();

    return {
      kind: "FunctionDeclaration",
      start,
      end: bodyEnd,
      name,
      returnType,
      parameters,
      modifiers,
      body: {
        kind: "BlockStatement",
        start: bodyStart,
        end: bodyEnd,
        statements: [],
      },
    };
  }

  private parseParameters(): ParameterNode[] {
    const parameters: ParameterNode[] = [];

    if (!this.stream.match(TokenType.LeftParen)) {
      this.reportError(this.stream.peek(), "Expected '('.");
      return parameters;
    }

    while (
      !this.stream.check(TokenType.RightParen) &&
      !this.stream.check(TokenType.EOF)
    ) {
      const start = this.stream.peek().start;
      const type = this.parseTypeRef();
      const name = this.consumeIdentifier("Expected parameter name.");

      parameters.push({
        kind: "Parameter",
        start,
        end: this.stream.previous().end,
        name,
        type,
      });

      if (!this.stream.match(TokenType.Comma)) {
        break;
      }
    }

    if (!this.stream.match(TokenType.RightParen)) {
      this.reportError(this.stream.peek(), "Expected ')'.");
    }

    return parameters;
  }

  private parseVariableDeclaration(
    modifiers: Modifiers,
  ): VariableDeclarationNode {
    const start = this.stream.peek().start;
    const type = this.parseTypeRef();
    const name = this.consumeIdentifier("Expected variable name.");
    let initializer: IdentifierNode | undefined;

    if (this.stream.peek().lexeme === "=") {
      const equals = this.stream.advance();
      this.skipUntilDeclarationEnd();

      initializer = {
        kind: "Identifier",
        start: equals.start,
        end: Math.max(equals.end, this.stream.previous().end),
        name: "<initializer>",
      };
    } else {
      this.skipUntilDeclarationEnd();
    }

    const end = this.stream.peek().end;
    this.stream.match(TokenType.Semicolon, TokenType.NewLine);

    return {
      kind: "VariableDeclaration",
      start,
      end,
      name,
      type,
      initializer,
      modifiers,
    };
  }

  private skipUntilDeclarationEnd(): void {
    while (
      !this.stream.check(TokenType.Semicolon) &&
      !this.stream.check(TokenType.NewLine) &&
      !this.stream.check(TokenType.RightBrace) &&
      !this.stream.check(TokenType.EOF)
    ) {
      this.stream.advance();
    }
  }

  private skipBlock(): number {
    let depth = 1;

    while (depth > 0 && !this.stream.check(TokenType.EOF)) {
      const token = this.stream.advance();

      if (token.type === TokenType.LeftBrace) {
        depth++;
      } else if (token.type === TokenType.RightBrace) {
        depth--;
      }
    }

    if (depth > 0) {
      this.reportError(this.stream.peek(), "Expected '}'.");
    }

    return this.stream.previous().end;
  }

  private parseTypeRef(): TypeRef {
    const name = this.stream.advance().lexeme;
    const genericArgs: TypeRef[] = [];

    if (this.stream.match(TokenType.Less)) {
      do {
        genericArgs.push(this.parseTypeRef());
      } while (this.stream.match(TokenType.Comma));

      if (!this.stream.match(TokenType.Greater)) {
        this.reportError(this.stream.peek(), "Expected '>'.");
      }
    }

    return {
      name,
      genericArgs: genericArgs.length > 0 ? genericArgs : undefined,
    };
  }

  private parseModifiers(): Modifiers {
    const modifiers = defaultModifiers();

    for (;;) {
      switch (this.stream.peek().lexeme) {
        case "public":
          modifiers.visibility = VisibilityType.Public;
          break;
        case "private":
          modifiers.visibility = VisibilityType.Private;
          break;
        case "const":
          modifiers.mutability = MutabilityType.Const;
          break;
        case "constexpr":
          modifiers.mutability = MutabilityType.Constexpr;
          break;
        case "mutable":
          modifiers.mutability = MutabilityType.Mutable;
          break;
        case "global":
          modifiers.storage = StorageType.Global;
          break;
        case "local":
          modifiers.storage = StorageType.Local;
          break;
        case "abstract":
          modifiers.abstract = true;
          break;
        case "override":
          modifiers.override = true;
          break;
        case "task":
          modifiers.task = true;
          break;
        default:
          return modifiers;
      }

      this.stream.advance();
    }
  }

  private isTypeLike(token: Token): boolean {
    return (
      token.type === TokenType.Type ||
      token.type === TokenType.Identifier ||
      token.lexeme === "auto"
    );
  }

  private consumeIdentifier(message: string): string {
    const token = this.stream.peek();

    if (
      token.type === TokenType.Identifier ||
      token.type === TokenType.Keyword
    ) {
      this.stream.advance();
      return token.lexeme;
    }

    this.reportError(token, message);
    this.stream.advance();
    return "<missing>";
  }

  private reportError(token: Token, message: string): void {
    this.diagnostics.push({
      start: token.start,
      end: token.end,
      message,
    });
  }

  private synchronize(): void {
    while (
      !this.stream.check(TokenType.EOF) &&
      !this.stream.check(TokenType.RightBrace)
    ) {
      if (this.stream.match(TokenType.Semicolon, TokenType.NewLine)) {
        return;
      }

      this.stream.advance();
    }
  }
}
