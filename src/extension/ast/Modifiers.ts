export enum VisibilityType {
  Public = "public",
  Private = "private",
  Default = "default",
}

export enum MutabilityType {
  Mutable = "mutable",
  Const = "const",
  Constexpr = "constexpr",
}

export enum StorageType {
  Global = "global",
  Local = "local",
  Default = "default",
}

export interface Modifiers {
  visibility: VisibilityType;
  mutability: MutabilityType;
  storage: StorageType;
  abstract?: boolean;
  override?: boolean;
  task?: boolean;
}

export function defaultModifiers(): Modifiers {
  return {
    visibility: VisibilityType.Default,
    mutability: MutabilityType.Mutable,
    storage: StorageType.Default,
  };
}
