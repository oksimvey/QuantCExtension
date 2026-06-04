import { PairedStructure } from "../structures/PairedStructure";


export const PAIRED_STRUCTURES = new Array<PairedStructure>();

export const Brackets : PairedStructure = {
    identifier : "Brackets",
    left : "{",
    right : "}"
}

export const Parenthesis : PairedStructure = {
    identifier : "Parenthesis",
    left : "(",
    right : ")"
}

export const SquareBrackets : PairedStructure = {
    identifier : "Square Brackets",

    left : "[",
    right : "]"
}

export const AngleBrackets : PairedStructure = {
    identifier : "Angle Brackets",
    left : "<",
    right : ">"

}

export const SingleQuotes : PairedStructure = {
    identifier : "Single Quotes",
    left : "'",
    right : "'"
}

export const DoubleQuotes : PairedStructure = {
    identifier : "Double Quotes",
    left : '"',
    right : '"'
}

export function setupPairedStructures(){
    PAIRED_STRUCTURES.push(
        Parenthesis,
        SquareBrackets,
        Brackets,
        AngleBrackets,
        SingleQuotes,
        DoubleQuotes
    );
}