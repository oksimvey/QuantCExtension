import { classifyIdentifier, getCustomOperators } from "./Keywords";
import { LexerDiagnostic } from "./LexerDiagnostic";
import { Token } from "./Token";
import { TokenType } from "./TokenType";

export interface LexerResult {
  tokens: Token[];
  diagnostics: LexerDiagnostic[];
}

const STANDARD_OPERATORS = [
  "**",
  "==",
  "!=",
  "<=",
  ">=",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "&&",
  "||",
  "::",
  "=>",
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "!",
  "&",
  "|",
  "^",
  "~",
  "?",
];

const PUNCTUATION: Record<string, TokenType> = {
  "(": TokenType.LeftParen,
  ")": TokenType.RightParen,
  "{": TokenType.LeftBrace,
  "}": TokenType.RightBrace,
  "[": TokenType.LeftBracket,
  "]": TokenType.RightBracket,
  ",": TokenType.Comma,
  ".": TokenType.Dot,
  ":": TokenType.Colon,
  ";": TokenType.Semicolon,
  "<": TokenType.Less,
  ">": TokenType.Greater,
};

export class Lexer {
  private offset = 0;
  private line = 0;
  private column = 0;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: LexerDiagnostic[] = [];

  constructor(private readonly source: string) {}

  scan(): LexerResult {
    while (this.offset < this.source.length) {
      this.scanToken();
    }

    this.tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      start: this.offset,
      end: this.offset,
      line: this.line,
      column: this.column,
    });

    return {
      tokens: this.tokens,
      diagnostics: this.diagnostics,
    };
  }

  private scanToken(): void {
    const char = this.peek();

    if (char === " " || char === "\t" || char === "\r") {
      this.advance();
      return;
    }

    if (char === "\n") {
      this.emit(TokenType.NewLine, 1);
      return;
    }

    if (char === "/" && this.peek(1) === "/") {
      this.scanLineComment();
      return;
    }

    if (char === "/" && this.peek(1) === "*") {
      this.scanBlockComment();
      return;
    }

    if (char === '"' || char === "'") {
      this.scanString(char, char === "'" ? TokenType.Char : TokenType.String);
      return;
    }

    if (/[0-9]/.test(char)) {
      this.scanNumber();
      return;
    }

    if (/[A-Za-z_]/.test(char)) {
      this.scanIdentifier();
      return;
    }

    if (this.scanOperator()) {
      return;
    }

    const punctuation = PUNCTUATION[char];
    if (punctuation !== undefined) {
      this.emit(punctuation, 1);
      return;
    }

    if (char.charCodeAt(0) > 127) {
      this.emit(TokenType.CustomOperator, 1);
      return;
    }

    const start = this.offset;
    this.advance();
    this.diagnostics.push({
      start,
      end: this.offset,
      message: "Unexpected character '" + char + "'.",
    });
  }

  private scanLineComment(): void {
    while (this.offset < this.source.length && this.peek() !== "\n") {
      this.advance();
    }
  }

  private scanBlockComment(): void {
    const start = this.offset;
    this.advance();
    this.advance();

    while (
      this.offset < this.source.length &&
      !(this.peek() === "*" && this.peek(1) === "/")
    ) {
      this.advance();
    }

    if (this.offset >= this.source.length) {
      this.diagnostics.push({
        start,
        end: this.offset,
        message: "Unterminated block comment.",
      });
      return;
    }

    this.advance();
    this.advance();
  }

  private scanIdentifier(): void {
    const start = this.offset;
    const line = this.line;
    const column = this.column;

    while (/[A-Za-z0-9_]/.test(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(start, this.offset);
    this.tokens.push({
      type: classifyIdentifier(lexeme),
      lexeme,
      start,
      end: this.offset,
      line,
      column,
    });
  }

  private scanNumber(): void {
    const start = this.offset;
    const line = this.line;
    const column = this.column;

    while (/[0-9]/.test(this.peek())) {
      this.advance();
    }

    if (this.peek() === "." && /[0-9]/.test(this.peek(1))) {
      this.advance();

      while (/[0-9]/.test(this.peek())) {
        this.advance();
      }
    }

    this.tokens.push({
      type: TokenType.Number,
      lexeme: this.source.slice(start, this.offset),
      start,
      end: this.offset,
      line,
      column,
    });
  }

  private scanString(quote: string, type: TokenType): void {
    const start = this.offset;
    const line = this.line;
    const column = this.column;

    this.advance();
    let escaped = false;

    while (this.offset < this.source.length) {
      const char = this.peek();

      if (!escaped && char === quote) {
        this.advance();
        this.tokens.push({
          type,
          lexeme: this.source.slice(start, this.offset),
          start,
          end: this.offset,
          line,
          column,
        });
        return;
      }

      escaped = char === "\\" && !escaped;
      if (char !== "\\") {
        escaped = false;
      }

      this.advance();
    }

    this.diagnostics.push({
      start,
      end: this.offset,
      message: "Unterminated literal.",
    });
  }

  private scanOperator(): boolean {
    const customOperators = getCustomOperators();
    const operators = [...customOperators, ...STANDARD_OPERATORS].sort(
      (a, b) => b.length - a.length,
    );

    const operator = operators.find((candidate) =>
      this.source.startsWith(candidate, this.offset),
    );

    if (!operator) {
      return false;
    }

    this.emit(
      customOperators.includes(operator)
        ? TokenType.CustomOperator
        : TokenType.Operator,
      operator.length,
    );

    return true;
  }

  private emit(type: TokenType, length: number): void {
    const start = this.offset;
    const line = this.line;
    const column = this.column;

    for (let index = 0; index < length; index++) {
      this.advance();
    }

    this.tokens.push({
      type,
      lexeme: this.source.slice(start, this.offset),
      start,
      end: this.offset,
      line,
      column,
    });
  }

  private advance(): void {
    const char = this.source[this.offset++] ?? "";

    if (char === "\n") {
      this.line++;
      this.column = 0;
      return;
    }

    this.column++;
  }

  private peek(offset = 0): string {
    return this.source[this.offset + offset] ?? "\0";
  }
}
