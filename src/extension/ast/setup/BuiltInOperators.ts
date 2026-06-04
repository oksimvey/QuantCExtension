import { Operator } from "./Operator";


export const BuiltInOperators = new Map<string, Operator>();

export const AddOperator : Operator = {
    symbol: "+",
    precedence: 1,
    comment: "Adds two values together. If both operands are numbers, it performs numeric addition. If either operand is a string, it performs string concatenation."
};

export const SubtractOperator : Operator = {
    symbol: "-",
    precedence: 1,
    comment: "Subtracts the right operand from the left operand. If both operands are numbers, it performs numeric subtraction. If either operand is a string, it attempts to convert both operands to numbers and then performs subtraction."
};

export const MultiplyOperator : Operator = {
    symbol: "*",
    precedence: 2,
    comment: "Multiplies two values together. If both operands are numbers, it performs numeric multiplication. If either operand is a string, it attempts to convert both operands to numbers and then performs multiplication."
};


export const DivideOperator : Operator = {
    symbol: "/",
    precedence: 2,
    comment: "Divides the left operand by the right operand. If both operands are numbers, it performs numeric division. If either operand is a string, it attempts to convert both operands to numbers and then performs division."
};

export const PowOperator : Operator = {
    symbol: "**",
    precedence: 3,
    comment: "Raises the left operand to the power of the right operand."
}

export const ModOperator : Operator = {
    symbol: "%",
    precedence: 2,
    comment: "Returns the remainder of the division of the left operand by the right operand."
}

export const AssignOperator : Operator = {
    symbol: "=",
    precedence: 0,
    comment: "Assigns the right operand to the left operand."
}

export const AddAssignOperator : Operator = {
    symbol: "+=",
    precedence: 0,
    comment: "Adds the right operand to the left operand and assigns the result to the left operand."
}

export const SubtractAssignOperator : Operator = {
    symbol: "-=",
    precedence: 0,
    comment: "Subtracts the right operand from the left operand and assigns the result to the left operand."
}

export const MultiplyAssignOperator : Operator = {
    symbol: "*=",
    precedence: 0,
    comment: "Multiplies the left operand by the right operand and assigns the result to the left operand."
}

export const DivideAssignOperator : Operator = {
    symbol: "/=",
    precedence: 0,
    comment: "Divides the left operand by the right operand and assigns the result to the left operand."
}

export const ModAssignOperator : Operator = {
    symbol: "%=",
    precedence: 0,
    comment: "Calculates the remainder of dividing the left operand by the right operand and assigns the result to the left operand."
}

export const PowAssignOperator : Operator = {
    symbol: "**=",
    precedence: 0,
    comment: "Raises the left operand to the power of the right operand and assigns the result to the left operand."
}

export const IncrementOperator : Operator = {
    symbol: "++",
    precedence: 0,
    comment: "Increments the value of the left operand by 1."
}

export const DecrementOperator : Operator = {
    symbol: "--",
    precedence: 0,
    comment: "Decrements the value of the left operand by 1."
}

export const BitwiseXorOperator : Operator = {
    symbol: "^",
    precedence: 0,
    comment: "Performs bitwise XOR operation on the left and right operands."
}

export const BitwiseAndOperator : Operator = {
    symbol: "&",
    precedence: 0,
    comment: "Performs bitwise AND operation on the left and right operands."
}

export const BitwiseOrOperator : Operator = {
    symbol: "|",
    precedence: 0,
    comment: "Performs bitwise OR operation on the left and right operands."    
}

export const BitwiseShiftLeft : Operator = {
    symbol: "<<",
    precedence: 0,
    comment: "Performs bitwise left shift operation on the left operand by the number of positions specified by the right operand."
}


export const OrOperator : Operator = {
    symbol: "||",
    precedence: 0,
    comment: "Performs logical OR operation on the left and right operands."
}

export const AndOperator : Operator = {
    symbol: "&&",
    precedence: 0,
    comment: "Performs logical AND operation on the left and right operands."
}

export const NotOperator : Operator = {
    symbol: "!",
    precedence: 0,
    comment: "Performs logical NOT operation on the operand."
}

export const EqualOperator : Operator = {
    symbol: "==",
    precedence: 0,
    comment: "Checks if the left and right operands are equal."
}

export const UnequalOperator : Operator = {
    symbol: "!=",
    precedence: 0,
    comment: "Checks if the left and right operands are not equal."
}

export const BiggerThanOperator : Operator = {
    symbol: ">",
    precedence: 0,
    comment: "Checks if the left operand is greater than the right operand."
}

export const SmallerThanOperator : Operator = {
    symbol: "<",
    precedence: 0,
    comment: "Checks if the left operand is smaller than the right operand."
}

export const BiggerThanOrEqualOperator : Operator = {
    symbol: ">=",
    precedence: 0,
    comment: "Checks if the left operand is greater than or equal to the right operand."
}

export const SmallerThanOrEqualOperator : Operator = {
    symbol: "<=",
    precedence: 0,
    comment: "Checks if the left operand is smaller than or equal to the right operand."
}

export const SqrtOperator : Operator = {
    symbol : "√",
    precedence : 3,
    comment: "Returns the square root of a number. If the operand is negative, it returns NaN."
}

export function setupOperators(){
    BuiltInOperators.set(AssignOperator.symbol , AssignOperator);
    BuiltInOperators.set(SqrtOperator.symbol, SqrtOperator);
    BuiltInOperators.set(AddOperator.symbol, AddOperator);
    BuiltInOperators.set(SubtractOperator.symbol, SubtractOperator);
    BuiltInOperators.set(MultiplyOperator.symbol, MultiplyOperator);
    BuiltInOperators.set(DivideOperator.symbol, DivideOperator);

    BuiltInOperators.set(PowOperator.symbol, PowOperator);
    BuiltInOperators.set(ModOperator.symbol, ModOperator);

    BuiltInOperators.set(AddAssignOperator.symbol, AddAssignOperator);
    BuiltInOperators.set(SubtractAssignOperator.symbol, SubtractAssignOperator);
    BuiltInOperators.set(MultiplyAssignOperator.symbol, MultiplyAssignOperator);
    BuiltInOperators.set(DivideAssignOperator.symbol, DivideAssignOperator);
    BuiltInOperators.set(ModAssignOperator.symbol, ModAssignOperator);
    BuiltInOperators.set(PowAssignOperator.symbol, PowAssignOperator);

    BuiltInOperators.set(IncrementOperator.symbol, IncrementOperator);
    BuiltInOperators.set(DecrementOperator.symbol, DecrementOperator);

    BuiltInOperators.set(BitwiseXorOperator.symbol, BitwiseXorOperator);
    BuiltInOperators.set(BitwiseAndOperator.symbol, BitwiseAndOperator);
    BuiltInOperators.set(BitwiseOrOperator.symbol, BitwiseOrOperator);
    BuiltInOperators.set(BitwiseShiftLeft.symbol, BitwiseShiftLeft);

    BuiltInOperators.set(OrOperator.symbol, OrOperator);
    BuiltInOperators.set(AndOperator.symbol, AndOperator);
    BuiltInOperators.set(NotOperator.symbol, NotOperator);

    BuiltInOperators.set(EqualOperator.symbol, EqualOperator);

    BuiltInOperators.set(UnequalOperator.symbol, UnequalOperator);
    BuiltInOperators.set(BiggerThanOperator.symbol, BiggerThanOperator);

    BuiltInOperators.set(SmallerThanOperator.symbol, SmallerThanOperator);
    BuiltInOperators.set(BiggerThanOrEqualOperator.symbol, BiggerThanOrEqualOperator);
    BuiltInOperators.set(SmallerThanOrEqualOperator.symbol, SmallerThanOrEqualOperator);

}