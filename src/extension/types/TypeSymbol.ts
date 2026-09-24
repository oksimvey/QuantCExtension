export interface TypeMemberParameter {
  name: string;
  typeName: string;
}

export interface TypeMember {
  name: string;
  typeName: string;
  kind: "field" | "method";
  parameters?: TypeMemberParameter[];
}

export interface TypeSymbol {
  name: string;
  builtin: boolean;
  baseType?: string;
  members: Map<string, TypeMember>;
}
