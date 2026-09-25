import { ProgramNode } from "../ast/Nodes";
import { QCSymbol } from "../semantic/Symbol";
import { QCDiagnostic } from "../types/Diagnostic";

export interface FlowTypeFact {
  name: string;
  typeName: string;
  offset: number;
  scopeStart: number;
  scopeEnd: number;
  dynamic: boolean;
}

export interface SourceFile {
  uri: string;
  text: string;
  version: number;
  ast: ProgramNode;
  symbols: QCSymbol[];
  diagnostics: QCDiagnostic[];
  flowTypes: FlowTypeFact[];
}
