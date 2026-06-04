import { State } from "../diagonistic/State";
import { Statement } from "./Statement";
/**
 * Adds a statement if the trimmed slice is not empty.
 */
export function addStatement(
    statements: Statement[],
    text: string,
    start: number,
    end: number,
): void {
    const raw = text.slice(start, end).trim();

    if (raw.length === 0) return;

    statements.push({ text: raw, start, end });
}

/* =========================================================
 *  SMALL PURE HELPERS (lexical decisions)
 * ========================================================= */

/** Detect start of line comment "//" */
function isCommentStart(ch: string, next: string): boolean {
    return ch === "/" && next === "/";
}

/** Detect string opening quote */
function isStringStart(ch: string): boolean {
    return ch === '"' || ch === "'";
}

/** Detect statement boundary */
function isStatementDelimiter(ch: string): boolean {
    return ch === ";" || ch === "\n";
}

/* =========================================================
 *  STATE TRANSITIONS
 * ========================================================= */

/**
 * Handles transitions while in NORMAL code state.
 */
function handleNormalState(
    ch: string,
    next: string,
    i: number,
    ctx: {
        setState: (s: State) => void;
        setQuote: (q: string | null) => void;
        flush: (i: number) => void;
    },
): number | void {
    // Enter comment state
    if (isCommentStart(ch, next)) {
        ctx.setState(State.Comment);
        return i + 1; // skip second '/'
    }

    // Enter string state
    if (isStringStart(ch)) {
        ctx.setState(State.String);
        ctx.setQuote(ch);
        return;
    }

    // End of statement
    if (isStatementDelimiter(ch)) {
        ctx.flush(i);
    }
}

/**
 * Handles transitions while inside a comment.
 * Comment ends only at newline.
 */
function handleCommentState(
    ch: string,
    ctx: { setState: (s: State) => void; setStart: (i: number) => void },
    i: number,
): void {
    if (ch === "\n") {
        ctx.setState(State.Normal);
        ctx.setStart(i + 1);
    }
}

/**
 * Handles transitions while inside a string.
 * Supports escaping and closing quote detection.
 */
function handleStringState(
    ch: string,
    quoteChar: string | null,
    i: number,
    ctx: {
        setState: (s: State) => void;
        setQuote: (q: string | null) => void;
        skipNext: () => void;
    },
): void {
    // Escape sequence: skip next character
    if (ch === "\\") {
        ctx.skipNext();
        return;
    }

    // Closing quote
    if (ch === quoteChar) {
        ctx.setState(State.Normal);
        ctx.setQuote(null);
    }
}

/* =========================================================
 *  MAIN SCANNER
 * ========================================================= */

/**
 * Splits input into statements using a small FSM.
 *
 * Rules:
 * - ";" and "\n" end statements
 * - "//" starts comment until newline
 * - strings ignore delimiters inside quotes
 */
export function scanStatements(text: string): Statement[] {
    const statements: Statement[] = [];

    let state: State = State.Normal;
    let start = 0;
    let quoteChar: string | null = null;

    /** Flush current statement range */
    const flush = (i: number) => {
        addStatement(statements, text, start, i);
        start = i + 1;
    };

    /** State setters (keeps helpers pure) */
    const setState = (s: State) => (state = s);
    const setQuote = (q: string | null) => (quoteChar = q);
    const setStart = (i: number) => (start = i);

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        // =====================================================
        // NORMAL STATE
        // =====================================================
        if (state === State.Normal) {
            const skip = handleNormalState(ch, next, i, {
                setState,
                setQuote,
                flush,
            });

            if (typeof skip === "number") {
                i = skip;
            }
            continue;
        }

        // =====================================================
        // COMMENT STATE
        // =====================================================
        if (state === State.Comment) {
            handleCommentState(ch, { setState, setStart }, i);
            continue;
        }

        // =====================================================
        // STRING STATE
        // =====================================================
        if (state === State.String) {
            handleStringState(ch, quoteChar, i, {
                setState,
                setQuote,
                skipNext: () => i++,
            });
        }
    }

    // Flush last pending statement
    addStatement(statements, text, start, text.length);

    return statements;
}
