import { Token } from "./Token";
import { TokenType } from "./TokenType";

export class TokenStream {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)];
  }

  advance(): Token {
    const token = this.peek();

    if (token.type !== TokenType.EOF) {
      this.index++;
    }

    return token;
  }

  check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  match(...types: TokenType[]): boolean {
    if (!types.includes(this.peek().type)) {
      return false;
    }

    this.advance();
    return true;
  }

  skipTrivia(): void {
    while (this.match(TokenType.NewLine, TokenType.Semicolon)) {
      // Keep consuming separators.
    }
  }
}
