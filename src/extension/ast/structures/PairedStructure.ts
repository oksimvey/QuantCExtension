
import * as vscode from "vscode"
export interface PairedStructure {

    identifier : string,

    left : string,

    right : string,

}

export interface PairedPosHandler {

    leftPositions: vscode.Position[];

    rightPositions: vscode.Position[];

}