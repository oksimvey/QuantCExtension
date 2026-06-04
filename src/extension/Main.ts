import * as vscode from "vscode";
import { BuiltInTypes, setupTypes } from "./ast/setup/BuiltInTypes";

import { Keywords, setupKeywords } from "./ast/setup/Keywords";

import { setupOperators, BuiltInOperators } from "./ast/setup/BuiltInOperators";
import { scanStatements } from "./parser/ParserUtils";



export function scan(doc: vscode.TextDocument) {


  const text: string = doc.getText();

  const channel = vscode.window.createOutputChannel("Lexer Debug");
  channel.show(true);

  const statements = scanStatements(text);

  channel.appendLine("STATEMENTS:");
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    channel.appendLine(
      `[${i}] "${s.text}" (${s.start} → ${s.end})`,
    );
  }
}




export function activate(context: vscode.ExtensionContext) {
  setupKeywords();

  setupTypes();

  setupOperators();




  function update(doc: vscode.TextDocument) {
    if (doc.languageId !== "qc") return;

  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(update),
    vscode.workspace.onDidSaveTextDocument(scan),
    vscode.workspace.onDidChangeTextDocument((e) => update(e.document)),
    vscode.workspace.onDidChangeTextDocument((e) => update(e.document)),
  );

  if (vscode.window.activeTextEditor) {
    update(vscode.window.activeTextEditor.document);
  }

  // autocomplete
  const completion2 = vscode.languages.registerCompletionItemProvider("qc", {
    provideCompletionItems() {
      const arr: vscode.CompletionItem[] = [];

      for (const [key, value] of BuiltInTypes) {
        const item = new vscode.CompletionItem(
          key,
          vscode.CompletionItemKind.Variable,
        );
        item.insertText = key;
        item.detail = value.comment;
        item.documentation = new vscode.MarkdownString("### " + key);
        arr.push(item);
      }

      for (const [key, value] of Keywords) {
        const item = new vscode.CompletionItem(
          key,
          vscode.CompletionItemKind.Keyword,
        );
        item.insertText = key;
        item.detail = value.comment;
        item.documentation = new vscode.MarkdownString("### " + key);
        arr.push(item);
      }

      return arr;
    },
  });

  // hover
  const hover = vscode.languages.registerHoverProvider("qc", {
    provideHover(document, position) {
      // 1. Try normal word first (works for identifiers, keywords, types)
      const range = document.getWordRangeAtPosition(position);
      const word = range ? document.getText(range) : "";

      // helper to build hover
      const makeHover = (key: string, value: any) => {
        const md = new vscode.MarkdownString();
        md.appendMarkdown("### " + key + "\n\n");
        md.appendMarkdown(value.comment + "\n\n");
        return new vscode.Hover(md);
      };

      // 2. Normal lookup (fast path)
      for (const [key, value] of BuiltInTypes) {
        if (word === key) return makeHover(key, value);
      }

      for (const [key, value] of Keywords) {
        if (word === key) return makeHover(key, value);
      }

      // 3. Operator handling (window scan)
      const windowRange = new vscode.Range(
        position.translate(0, -1), // look left
        position.translate(0, 2), // look right
      );

      const windowText = document.getText(windowRange);

      const ops = [...BuiltInOperators.keys()].sort(
        (a, b) => b.length - a.length,
      ); // important

      for (const op of ops) {
        if (windowText.includes(op)) {
          return makeHover(op, BuiltInOperators.get(op));
        }
      }

      return null;
    },
  });

  context.subscriptions.push(completion2, hover);
}
