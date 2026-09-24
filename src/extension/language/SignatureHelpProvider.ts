import * as vscode from "vscode";
import { BUILTINS } from "../lexer/Keywords";
import { LanguageService } from "./LanguageService";

export class SignatureHelpProvider
  implements vscode.SignatureHelpProvider
{
  constructor(private readonly service: LanguageService) {}

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | undefined {
    const text = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position),
    );
    const call = text.match(/([A-Za-z_]\w*)\s*\(([^()]*)$/);

    if (!call) {
      return undefined;
    }

    const functionName = call[1];
    const builtin = BUILTINS.get(functionName);

    let label = builtin?.signature;
    let parameters = builtin
      ? this.parametersFromSignature(builtin.signature)
      : [];

    if (!label) {
      for (const indexedClass of this.service.project.allClasses()) {
        const method = this.service.project
          .classMembers(indexedClass.name)
          .find(
            (candidate) =>
              candidate.name === functionName &&
              candidate.kind === "method",
          );

        if (!method) {
          continue;
        }

        parameters = method.parameters.map(
          (parameter) =>
            parameter.typeName + " " + parameter.name,
        );
        label =
          functionName +
          "(" +
          parameters.join(", ") +
          "): " +
          method.typeName;
        break;
      }
    }

    if (!label) {
      return undefined;
    }

    const help = new vscode.SignatureHelp();
    const signature = new vscode.SignatureInformation(label);

    signature.parameters = parameters.map(
      (parameter) => new vscode.ParameterInformation(parameter),
    );

    help.signatures = [signature];
    help.activeSignature = 0;
    help.activeParameter = Math.max(
      0,
      call[2].trim().length === 0
        ? 0
        : call[2].split(",").length - 1,
    );

    return help;
  }

  private parametersFromSignature(signature: string): string[] {
    const match = signature.match(/^[^(]+\(([^)]*)\)/);

    if (!match || !match[1].trim()) {
      return [];
    }

    return match[1]
      .split(",")
      .map((parameter) => parameter.trim());
  }
}
