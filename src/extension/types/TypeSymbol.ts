export interface TypeMember {
  name: string;
  typeName: string;
  kind: "field" | "method";
  isGlobal: boolean;
  parameters?: { name: string; typeName: string }[];
}
export interface TypeSymbol {
  name: string;
  builtin: boolean;
  baseType?: string;
  members: Map<string, TypeMember>;
}
