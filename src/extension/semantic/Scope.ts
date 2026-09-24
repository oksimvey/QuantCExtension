import { QCSymbol } from "./Symbol";

export class Scope {
  private readonly symbols = new Map<string, QCSymbol>();

  constructor(readonly parent?: Scope) {}

  define(symbol: QCSymbol): boolean {
    if (this.symbols.has(symbol.name)) {
      return false;
    }

    this.symbols.set(symbol.name, symbol);
    return true;
  }

  resolve(name: string): QCSymbol | undefined {
    return this.symbols.get(name) ?? this.parent?.resolve(name);
  }

  values(): QCSymbol[] {
    return [...this.symbols.values()];
  }
}
