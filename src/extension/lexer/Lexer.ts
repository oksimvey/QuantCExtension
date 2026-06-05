import * as vscode from "vscode";
import { Brackets, Parenthesis, SquareBrackets } from "../ast/setup/PairedStructures";
import { PairedStructure } from "../ast/structures/PairedStructure";
import { LexerResult } from "./LexerResult";
import { Statement } from "./Statement";

// ── 1. DEFINE TOKEN TYPES ──────────────────────────────────────────────────
export enum TokenType {
  Structural, // (, ), {, }, [, ]
  Separator,  // ;, \n
  String,     // "...", '...'
  Number,     // 42, 3.14, 0xff (Numeric literals)
  Text,       // Code identifiers, keywords, operators, etc.
}

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  range: vscode.Range; // Pre-calculated for perfect VS Code highlights
}

// ── 2. PHASE 1: THE TOKENIZER (LEXER) ──────────────────────────────────────
export function tokenize(text: string, diagnostics: vscode.Diagnostic[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 0;
  let column = 0;

  function advance(ch: string) {
    i++;
    if (ch === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }

  // Helper to check if a character is a digit
  const isDigit = (ch: string) => ch >= "0" && ch <= "9";

  while (i < text.length) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : "";
    const startPos = new vscode.Position(line, column);
    const startIndex = i;

    // Skip generic whitespace
    if (ch === " " || ch === "\t" || ch === "\r") {
      advance(ch);
      continue;
    }

    // Handle Line Comments (//)
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") {
        advance(text[i]);
      }
      continue;
    }

    // Handle Block Comments (/* ... */)
    if (ch === "/" && next === "*") {
      advance(ch); // consume '/'
      advance(next); // consume '*'
      let closed = false;
      while (i < text.length) {
        if (text[i] === "*" && i + 1 < text.length && text[i + 1] === "/") {
          advance(text[i]); // consume '*'
          advance(text[i]); // consume '/'
          closed = true;
          break;
        }
        advance(text[i]);
      }
      if (!closed) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(startPos, new vscode.Position(line, column)),
          "Syntax error: Unclosed block comment",
          vscode.DiagnosticSeverity.Error
        ));
      }
      continue;
    }

    // Handle Strings ("..." or '...')
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(ch); // consume opening quote
      let escaped = false;
      let closed = false;

      while (i < text.length) {
        const curr = text[i];
        if (escaped) {
          escaped = false;
        } else if (curr === "\\") {
          escaped = true;
        } else if (curr === quote) {
          advance(curr); // consume closing quote
          closed = true;
          break;
        }
        advance(curr);
      }

      if (!closed) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(startPos, new vscode.Position(startPos.line, startPos.character + 1)),
          `Syntax error: Unterminated string. Expected closing ${quote}`,
          vscode.DiagnosticSeverity.Error
        ));
      }

      tokens.push({
        type: TokenType.String,
        value: text.slice(startIndex, i),
        start: startIndex,
        end: i,
        range: new vscode.Range(startPos, new vscode.Position(line, column))
      });
      continue;
    }

    // Handle Statement Separators
    if (ch === ";" || ch === "\n") {
      advance(ch);
      tokens.push({
        type: TokenType.Separator,
        value: ch,
        start: startIndex,
        end: i,
        range: new vscode.Range(startPos, new vscode.Position(line, column))
      });
      continue;
    }

    // Handle Structural Pairs
    if ([ "{", "}", "(", ")", "[", "]" ].includes(ch)) {
      advance(ch);
      tokens.push({
        type: TokenType.Structural,
        value: ch,
        start: startIndex,
        end: i,
        range: new vscode.Range(startPos, new vscode.Position(line, column))
      });
      continue;
    }

    // Handle Number Literals
    if (isDigit(ch)) {
      let hasDecimal = false;
      let value = "";

      while (i < text.length) {
        const curr = text[i];
        
        if (isDigit(curr)) {
          value += curr;
          advance(curr);
        } else if (curr === "." && !hasDecimal && i + 1 < text.length && isDigit(text[i + 1])) {
          hasDecimal = true;
          value += curr;
          advance(curr);
        } else if (curr === "." && hasDecimal) {
          advance(curr);
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(startPos, new vscode.Position(line, column)),
            `Syntax error: Invalid numeric literal, multiple decimal points encountered`,
            vscode.DiagnosticSeverity.Error
          ));
        } else {
          break;
        }
      }

      tokens.push({
        type: TokenType.Number,
        value: value,
        start: startIndex,
        end: i,
        range: new vscode.Range(startPos, new vscode.Position(line, column))
      });
      continue;
    }

    // Handle Generic Code Text (Identifiers / Operators / Keywords)
    let value = "";
    while (
      i < text.length &&
      !isDigit(text[i]) && 
      text[i] !== ";" && text[i] !== "\n" &&
      text[i] !== '"' && text[i] !== "'" &&
      text[i] !== " " && text[i] !== "\t" && text[i] !== "\r" &&
      !(text[i] === "/" && i + 1 < text.length && (text[i + 1] === "/" || text[i + 1] === "*")) &&
      ![ "{", "}", "(", ")", "[", "]" ].includes(text[i])
    ) {
      value += text[i];
      advance(text[i]);
    }

    if (value.length > 0) {
      tokens.push({
        type: TokenType.Text,
        value: value,
        start: startIndex,
        end: i,
        range: new vscode.Range(startPos, new vscode.Position(line, column))
      });
    }
  }

  return tokens;
}

// ── 3. PHASE 2: PARSER / STATEMENT SCANNER ─────────────────────────────────
export const LexicalPairedStructures = new Set<PairedStructure>([
  Brackets,
  Parenthesis,
  SquareBrackets
]);

export function scanStatements(text: string): LexerResult {
  const statements: Statement[] = [];
  const diagnostics: vscode.Diagnostic[] = [];

  const tokens = tokenize(text, diagnostics);

  const stack: { struct: PairedStructure; token: Token }[] = [];
  let statementStart = 0;

  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];

    if (token.type === TokenType.Structural) {
      for (const struct of LexicalPairedStructures) {
        if (token.value === struct.left) {
          stack.push({ struct, token });
          break;
        } else if (token.value === struct.right) {
          const top = stack.pop();
          if (!top) {
            diagnostics.push(new vscode.Diagnostic(
              token.range,
              `Syntax error: Unexpected '${token.value}' (missing opening '${struct.left}')`,
              vscode.DiagnosticSeverity.Error
            ));
          } else if (top.struct !== struct) {
            diagnostics.push(new vscode.Diagnostic(
              token.range,
              `Syntax error: Expected to close '${top.struct.right}', but found '${token.value}'`,
              vscode.DiagnosticSeverity.Error
            ));
          }
          break;
        }
      }
    }

    const isEndingToken = token.type === TokenType.Separator || k === tokens.length - 1;
    
    if (isEndingToken && stack.length === 0) {
      if (tokens[statementStart]) {
        const sliceStart = tokens[statementStart].start;
        const sliceEnd = token.end;
        const raw = text.slice(sliceStart, sliceEnd).trim();

        if (raw.length > 0) {
          statements.push({ text: raw, start: sliceStart, end: sliceEnd });
        }
      }
      statementStart = k + 1;
    }
  }

  while (stack.length > 0) {
    const unclosed = stack.pop()!;
    diagnostics.push(new vscode.Diagnostic(
      unclosed.token.range,
      `Syntax error: '${unclosed.struct.identifier}' was not closed (missing '${unclosed.struct.right}')`,
      vscode.DiagnosticSeverity.Error
    ));
  }

  return { statements, diagnostics };
}