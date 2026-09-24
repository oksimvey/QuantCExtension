import { ASTNode } from "../ast/ASTNode";
import { SymbolKind } from "./SymbolKind";

export interface QCSymbol {
  name: string;
  kind: SymbolKind;
  declaration: ASTNode;
  typeName?: string;
  containerName?: string;
}
