import * as vscode from "vscode"
import { Statement } from "./Statement";

export interface LexerResult {

    statements : Statement[]

    diagnostics  : vscode.Diagnostic[]

}