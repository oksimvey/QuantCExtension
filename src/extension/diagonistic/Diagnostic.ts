import { ErrorType } from "./ErrorType";
import * as vscode from "vscode";

export interface Diagostic {
    message : string;
    type : ErrorType;
    range : vscode.Range;
}