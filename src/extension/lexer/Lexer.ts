import { classifyIdentifier, getCustomOperators } from "./Keywords";
import { LexerDiagnostic } from "./LexerDiagnostic";
import { Token } from "./Token";
import { TokenType } from "./TokenType";

export interface LexerResult { tokens: Token[]; diagnostics: LexerDiagnostic[] }

const OPERATORS = [
  "**=", "<<=", ">>=", "==", "!=", "<=", ">=", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "&&", "||", "::", "=>", "<<", ">>", "**", "+", "-", "*", "/", "%", "=", "!", "&", "|", "^", "~", "?"
];

export class Lexer {
  private i = 0;
  private line = 0;
  private col = 0;
  private tokens: Token[] = [];
  private diagnostics: LexerDiagnostic[] = [];

  constructor(private source: string) {}

  scan(): LexerResult {
    while (this.i < this.source.length) this.scanOne();
    this.tokens.push({ type: TokenType.EOF, lexeme: "", start: this.i, end: this.i, line: this.line, column: this.col });
    return { tokens: this.tokens, diagnostics: this.diagnostics };
  }

  private scanOne(): void {
    const c = this.peek();

    if (c === " " || c === "\t" || c === "\r") { this.advance(); return; }
    if (c === "\n") { this.emit(TokenType.NewLine, 1); return; }

    if (c === "/" && this.peek(1) === "/") {
      while (this.i < this.source.length && this.peek() !== "\n") this.advance();
      return;
    }
    if (c === "/" && this.peek(1) === "*") { this.blockComment(); return; }

    if (c === "\"" || c === "'") {
      this.stringLiteral(c, c === "'" ? TokenType.Char : TokenType.String);
      return;
    }
    if (/[0-9]/.test(c)) { this.number(); return; }
    if (/[A-Za-z_]/.test(c)) { this.identifier(); return; }

    const custom = getCustomOperators();
    const operator = [...custom, ...OPERATORS].find(op => this.source.startsWith(op, this.i));
    if (operator) {
      this.emit(custom.includes(operator) ? TokenType.CustomOperator : TokenType.Operator, operator.length);
      return;
    }

    const punctuation: Record<string, TokenType> = {
      "(": TokenType.LeftParen, ")": TokenType.RightParen,
      "{": TokenType.LeftBrace, "}": TokenType.RightBrace,
      "[": TokenType.LeftBracket, "]": TokenType.RightBracket,
      ",": TokenType.Comma, ".": TokenType.Dot, ":": TokenType.Colon,
      ";": TokenType.Semicolon, "<": TokenType.Less, ">": TokenType.Greater
    };
    if (punctuation[c] !== undefined) { this.emit(punctuation[c], 1); return; }

    if (c.charCodeAt(0) > 127) { this.emit(TokenType.CustomOperator, 1); return; }

    const start = this.i;
    this.advance();
    this.diagnostics.push({ start, end: this.i, message: `Unexpected character '${c}'.` });
  }

  private identifier(): void {
    const start = this.i, line = this.line, column = this.col;
    while (/[A-Za-z0-9_]/.test(this.peek())) this.advance();
    const lexeme = this.source.slice(start, this.i);
    this.tokens.push({ type: classifyIdentifier(lexeme), lexeme, start, end: this.i, line, column });
  }

  private number(): void {
    const start = this.i, line = this.line, column = this.col;

    if (this.peek() === "0" && /[xX]/.test(this.peek(1))) {
      this.advance(); this.advance();
      while (/[0-9A-Fa-f]/.test(this.peek())) this.advance();
    } else if (this.peek() === "0" && /[bB]/.test(this.peek(1))) {
      this.advance(); this.advance();
      while (/[01]/.test(this.peek())) this.advance();
    } else {
      while (/[0-9]/.test(this.peek())) this.advance();
      if (this.peek() === "." && /[0-9]/.test(this.peek(1))) {
        this.advance();
        while (/[0-9]/.test(this.peek())) this.advance();
      }
      if (/[eE]/.test(this.peek())) {
        this.advance();
        if (/[+-]/.test(this.peek())) this.advance();
        while (/[0-9]/.test(this.peek())) this.advance();
      }
    }

    this.tokens.push({ type: TokenType.Number, lexeme: this.source.slice(start, this.i), start, end: this.i, line, column });
  }

  private stringLiteral(quote: string, type: TokenType): void {
    const start = this.i, line = this.line, column = this.col;
    this.advance();
    let escaped = false;

    while (this.i < this.source.length) {
      const ch = this.peek();
      if (!escaped && ch === quote) {
        this.advance();
        this.tokens.push({ type, lexeme: this.source.slice(start, this.i), start, end: this.i, line, column });
        return;
      }
      if (!escaped && ch === "\n") {
        this.diagnostics.push({ start, end: this.i, message: "Unterminated literal." });
        return;
      }
      escaped = ch === "\\" && !escaped;
      if (ch !== "\\") escaped = false;
      this.advance();
    }

    this.diagnostics.push({ start, end: this.i, message: "Unterminated literal." });
  }

  private blockComment(): void {
    const start = this.i;
    this.advance(); this.advance();
    while (this.i < this.source.length && !(this.peek() === "*" && this.peek(1) === "/")) this.advance();
    if (this.i >= this.source.length) {
      this.diagnostics.push({ start, end: this.i, message: "Unterminated block comment." });
      return;
    }
    this.advance(); this.advance();
  }

  private emit(type: TokenType, count: number): void {
    const start = this.i, line = this.line, column = this.col;
    for (let n = 0; n < count; n++) this.advance();
    this.tokens.push({ type, lexeme: this.source.slice(start, this.i), start, end: this.i, line, column });
  }

  private advance(): void {
    const ch = this.source[this.i++] ?? "";
    if (ch === "\n") { this.line++; this.col = 0; }
    else this.col++;
  }

  private peek(offset = 0): string { return this.source[this.i + offset] ?? "\0"; }
}
