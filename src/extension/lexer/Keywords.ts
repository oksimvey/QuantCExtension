import { TokenType } from "./TokenType";

export interface BuiltinDefinition {
  signature: string;
  documentation: string;
}

export const KEYWORDS = new Set([
  "function",
  "return",
  "if",
  "else",
  "while",
  "for",
  "true",
  "false",
  "continue",
  "break",
  "unsigned",
  "switch",
  "case",
  "default",
  "public",
  "mutable",
  "constexpr",
  "abstract",
  "class",
  "private",
  "const",
  "global",
  "local",
  "this",
  "new",
  "try",
  "wait",
  "await",
  "throw",
  "catch",
  "null",
  "super",
  "instanceof",
  "and",
  "or",
  "not",
  "delete",
  "extends",
  "pointer",
  "override",
  "address",
  "pointing",
  "reference",
  "enum",
  "task",
  "auto",
]);

export const TYPES = new Set([
  "byte",
  "short",
  "int",
  "long",
  "ubyte",
  "ushort",
  "uint",
  "ulong",
  "float",
  "double",
  "char",
  "string",
  "boolean",
  "void",
  "Array",
  "List",
  "HashMap",
  "Pointer",
  "UniquePointer",
  "SharedPointer",
  "Reference",
]);

export const BUILTINS = new Map<string, BuiltinDefinition>([
  ["print", { signature: "print(any value): void", documentation: "Prints a value to stdout." }],
  ["sqrt", { signature: "sqrt(number value): double", documentation: "Square root." }],
  ["abs", { signature: "abs(number value): number", documentation: "Absolute value." }],
  ["sin", { signature: "sin(number value): double", documentation: "Sine." }],
  ["cos", { signature: "cos(number value): double", documentation: "Cosine." }],
  ["tan", { signature: "tan(number value): double", documentation: "Tangent." }],
  ["min", { signature: "min(T a, T b): T", documentation: "Minimum." }],
  ["max", { signature: "max(T a, T b): T", documentation: "Maximum." }],
  ["pow", { signature: "pow(number x, number y): double", documentation: "Power." }],
  ["atan", { signature: "atan(number value): double", documentation: "Arc tangent." }],
  ["atan2", { signature: "atan2(number y, number x): double", documentation: "Two-argument arc tangent." }],
  ["acos", { signature: "acos(number value): double", documentation: "Arc cosine." }],
  ["asin", { signature: "asin(number value): double", documentation: "Arc sine." }],
  ["ceil", { signature: "ceil(number value): double", documentation: "Ceiling." }],
  ["floor", { signature: "floor(number value): double", documentation: "Floor." }],
  ["exp", { signature: "exp(number value): double", documentation: "Exponential." }],
  ["log", { signature: "log(number value): double", documentation: "Natural logarithm." }],
  ["log10", { signature: "log10(number value): double", documentation: "Base-10 logarithm." }],
  ["cosh", { signature: "cosh(number value): double", documentation: "Hyperbolic cosine." }],
  ["sinh", { signature: "sinh(number value): double", documentation: "Hyperbolic sine." }],
  ["tanh", { signature: "tanh(number value): double", documentation: "Hyperbolic tangent." }],
  ["acosh", { signature: "acosh(number value): double", documentation: "Inverse hyperbolic cosine." }],
  ["asinh", { signature: "asinh(number value): double", documentation: "Inverse hyperbolic sine." }],
  ["atanh", { signature: "atanh(number value): double", documentation: "Inverse hyperbolic tangent." }],
]);

const customOperators = new Set<string>();

export function registerCustomOperator(operator: string): void {
  if (operator) {
    customOperators.add(operator);
  }
}

export function getCustomOperators(): string[] {
  return [...customOperators].sort((a, b) => b.length - a.length);
}

export function classifyIdentifier(value: string): TokenType {
  if (KEYWORDS.has(value)) {
    return TokenType.Keyword;
  }

  if (TYPES.has(value)) {
    return TokenType.Type;
  }

  return TokenType.Identifier;
}
