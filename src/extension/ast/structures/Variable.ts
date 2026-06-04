
import { MutabilityModifier } from "../modifiers/MutabilityModifier";
import { ScopeModifier } from "../modifiers/ScopeModifier";
import { VisibilityModifier } from "../modifiers/VisibilityModifier";
import { AutoType, BuiltInTypes } from "../setup/BuiltInTypes";
import { VariableType } from "../setup/VariableType";

export interface Variable {
  visibility: VisibilityModifier;

  scope: ScopeModifier;

  mutability: MutabilityModifier;

  type: VariableType;

  identifier: string;
}

export function variableBuilder(
  identifier_: string,
  visibility_?: VisibilityModifier,
  scope_?: ScopeModifier,
  mutability_?: MutabilityModifier,
  type_?: VariableType,
): Variable {
  return {
    visibility: visibility_ || VisibilityModifier.Private,
    scope: scope_ || ScopeModifier.Member,
    mutability: mutability_ || MutabilityModifier.Mutable,
    type: type_ || AutoType,
    identifier: identifier_,
  };
}
