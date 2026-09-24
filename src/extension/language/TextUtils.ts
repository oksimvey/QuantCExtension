export interface TextPosition {
  line: number;
  character: number;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

export function offsetToPosition(
  text: string,
  offset: number,
): TextPosition {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const line = before.split("\n").length - 1;
  const lineStart = text.lastIndexOf("\n", safeOffset - 1) + 1;

  return {
    line,
    character: safeOffset - lineStart,
  };
}

export function findWordOffsets(text: string, word: string): number[] {
  if (!word) {
    return [];
  }

  const pattern = new RegExp("\\b" + escapeRegExp(word) + "\\b", "g");
  const offsets: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    offsets.push(match.index);
  }

  return offsets;
}
