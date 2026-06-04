import { Keyword } from "./Keyword";


export const Keywords = new Map<string, Keyword>();


export const PublicKeyword : Keyword = {
    identifier : "public",
    comment : "access modifier that allows the member to be accessed from any code"
}

export const ProtectedKeyword : Keyword = {
    identifier : "protected",
    comment : "access modifier that allows the member to be accessed within its own class and by derived class instances"
}

export const PrivateKeyword : Keyword = {
    identifier : "private",
    comment : "access modifier that allows the member to be accessed only within its own class"
}

export const StaticKeyword : Keyword = {
    identifier : "static",
    comment : "modifier that indicates that the member belongs to the class itself rather than to any specific instance of the class"
}

export const MemberKeyword : Keyword = {
    identifier : "member",
    comment : "keyword used to declare a member of a class"
}

export const ConstKeyword : Keyword = {
    identifier : "const",
    comment : "keyword used to declare a constant variable that cannot be reassigned after its initial value is set"
}

export const MutableKeyword : Keyword = {
    identifier : "mutable",
    comment : "keyword used to declare a variable that can be modified after its initial value is set"
}

export const AndKeyword : Keyword = {
    identifier : "and",
    comment : "logical operator that returns true if both operands are true"
}

export const OrKeyword : Keyword = {
    identifier : "or",
    comment : "logical operator that returns true if at least one of the operands is true"
}

export const NotKeyword : Keyword = {
    identifier : "not",
    comment : "logical operator that returns true if the operand is false"
}

export const IfKeyword : Keyword = {
    identifier : "if",
    comment : "conditional statement that executes a block of code if a specified condition is true"
}

export const ElseKeyword : Keyword = {
    identifier : "else",
    comment : "conditional statement that executes a block of code if the condition in the if statement is false"
}

export const ForKeyword : Keyword = {
    identifier : "for",
    comment : "looping statement that allows code to be executed repeatedly based on a condition"
}

export const WhileKeyword : Keyword = {
    identifier : "while",
    comment : "looping statement that executes a block of code as long as a specified condition is true"
}

export const ContinueKeyword : Keyword = {
    identifier : "continue",
    comment : "statement that skips the current iteration of a loop and continues with the next iteration"
}

export const BreakKeyword : Keyword = {
    identifier : "break",
    comment : "statement that exits a loop or switch statement"
}

export const ReturnKeyword : Keyword = {
    identifier : "return",
    comment : "statement that exits a function and optionally returns a value"
}

export const SwitchKeyword : Keyword = {
    identifier : "switch",
    comment : "statement that allows a variable to be tested for equality against a list of values"
}

export const CaseKeyword : Keyword = {
    identifier : "case",
    comment : "statement that defines a block of code to be executed if a specified value matches the value of the switch expression"
}

export const TryKeyword : Keyword = {
    identifier : "try",
    comment : "block of code that is used to handle exceptions or errors that may occur during the execution of a program"
}

export const CatchKeyword : Keyword = {
    identifier : "catch",
    comment : "block of code that is used to handle exceptions or errors that may occur during the execution of a program, and is executed if an exception is thrown in the try block"
}

export const ThrowKeyword : Keyword = {
    identifier : "throw",
    comment : "statement that is used to signal the occurrence of an exception or error during the execution of a program"
}

export const DefaultKeyword : Keyword = {
    identifier : "default",
    comment : "statement that defines a block of code to be executed if no case matches the value of the switch expression"
}

export const AwaitKeyword : Keyword = {
    identifier : "await",
    comment : "keyword used to wait for a Promise to resolve or reject before continuing with the execution of the code"
}

export const WaitKeyword : Keyword = {
    identifier : "wait",
    comment : "keyword used to pause the execution of a thread until a specified condition is met or a certain amount of time has passed"
}

export const FunctionKeyword : Keyword = {
    identifier : "function",
    comment : "keyword used to declare a function"
}

export const OperatorKeyword: Keyword = {
    identifier : "operator",
    comment : "keyword used to declare an operator overload"
}

export const EnumKeyword : Keyword = {
    identifier : "enum",
    comment : "keyword used to declare an enumeration, a distinct type that consists of a set of named constants called the enumerator list"
}

export const ClassKeyword : Keyword = {
    identifier : "class",
    comment : "keyword used to declare a class"
}

export const ExtendsKeyword : Keyword = {
    identifier : "extends",
    comment : "keyword used to indicate that a class is inheriting from another class"
}

export const SuperKeyword : Keyword = {
    identifier : "super",
    comment : "keyword used to call the constructor of the parent class or to access its properties and methods"
}

export const OverrideKeyword : Keyword = {
    identifier : "override",
    comment : "keyword used to indicate that a method is intended to override a method in the parent class"
}

export const TrueKeyword : Keyword = {
    identifier : "true",
    comment : "boolean literal representing the logical value true"
}

export const FalseKeyword : Keyword = {
    identifier : "false",
    comment : "boolean literal representing the logical value false"
}

export const NullKeyword : Keyword = {
    identifier : "null",
    comment : "literal representing the absence of a value or a null reference"
}

export const InstanceOfKeyword : Keyword = {
    identifier : "instanceof",
    comment : "keyword used to check if an object is an instance of a specific class or constructor function"
}

export const ThisKeyword : Keyword = {
    identifier : "this",
    comment : "keyword that refers to the current instance of a class or object"
}

export const VoidKeyword : Keyword = {
    identifier : "void",
    comment : "keyword used to indicate that a function does not return a value"
}

export const EqualsKeyword : Keyword = {
    identifier : "equals",
    comment : "keyword used to compare two values for equality"
}

export const UnequalsKeyword : Keyword = {
    identifier : "unequals",
    comment : "keyword used to compare two values for inequality"
}

export function setupKeywords(){

    Keywords.set(EqualsKeyword.identifier, EqualsKeyword);
    Keywords.set(UnequalsKeyword.identifier, UnequalsKeyword);

    Keywords.set(VoidKeyword.identifier, VoidKeyword);
    Keywords.set(PublicKeyword.identifier, PublicKeyword);
    Keywords.set(ProtectedKeyword.identifier, ProtectedKeyword);
    Keywords.set(PrivateKeyword.identifier, PrivateKeyword);

    Keywords.set(StaticKeyword.identifier, StaticKeyword);
    Keywords.set(MemberKeyword.identifier, MemberKeyword);
    Keywords.set(ConstKeyword.identifier, ConstKeyword);
    Keywords.set(MutableKeyword.identifier, MutableKeyword);

    Keywords.set(AndKeyword.identifier, AndKeyword);
    Keywords.set(OrKeyword.identifier, OrKeyword);
    Keywords.set(NotKeyword.identifier, NotKeyword);

    Keywords.set(IfKeyword.identifier, IfKeyword);
    Keywords.set(ElseKeyword.identifier, ElseKeyword);
    Keywords.set(ForKeyword.identifier, ForKeyword);
    Keywords.set(WhileKeyword.identifier, WhileKeyword);
    Keywords.set(ContinueKeyword.identifier, ContinueKeyword);
    Keywords.set(BreakKeyword.identifier, BreakKeyword);

    Keywords.set(ReturnKeyword.identifier, ReturnKeyword);
    Keywords.set(SwitchKeyword.identifier, SwitchKeyword);
    Keywords.set(CaseKeyword.identifier, CaseKeyword);
    Keywords.set(DefaultKeyword.identifier, DefaultKeyword);

    Keywords.set(TryKeyword.identifier, TryKeyword);
    Keywords.set(CatchKeyword.identifier, CatchKeyword);
    Keywords.set(ThrowKeyword.identifier, ThrowKeyword);

    Keywords.set(AwaitKeyword.identifier, AwaitKeyword);
    Keywords.set(WaitKeyword.identifier, WaitKeyword);

    Keywords.set(FunctionKeyword.identifier, FunctionKeyword);
    Keywords.set(OperatorKeyword.identifier, OperatorKeyword);
    Keywords.set(EnumKeyword.identifier, EnumKeyword);
    Keywords.set(ClassKeyword.identifier, ClassKeyword);
    Keywords.set(ExtendsKeyword.identifier, ExtendsKeyword);
    Keywords.set(SuperKeyword.identifier, SuperKeyword);
    Keywords.set(OverrideKeyword.identifier, OverrideKeyword);
    Keywords.set(TrueKeyword.identifier, TrueKeyword);
    Keywords.set(FalseKeyword.identifier, FalseKeyword);
    Keywords.set(NullKeyword.identifier, NullKeyword);
    Keywords.set(InstanceOfKeyword.identifier, InstanceOfKeyword);
    Keywords.set(ThisKeyword.identifier, ThisKeyword);
}

