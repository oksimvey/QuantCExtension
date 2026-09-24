import { TokenType } from "./TokenType";

export interface SourceRange {
  start: number;
  end: number;
}

export interface Token extends SourceRange {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
}
