import type { ReactNode } from "react";

type TokenKind = "comment" | "string" | "number" | "keyword" | "control" | "type" | "function" | "property" | "punctuation";

// Matches the editor palette used by the control plane's suggested changes.
const COLORS: Record<TokenKind, string> = {
  comment: "#6a9955",
  string: "#ce9178",
  number: "#b5cea8",
  keyword: "#569cd6",
  control: "#c586c0",
  type: "#4ec9b0",
  function: "#dcdcaa",
  property: "#9cdcfe",
  punctuation: "#a0a0a0",
};

const CONTROL = new Set([
  "if", "else", "for", "while", "return", "break", "continue", "switch", "case",
  "default", "try", "catch", "finally", "throw", "await", "yield", "new", "do",
]);
const KEYWORDS = new Set([
  "const", "let", "var", "final", "late", "required", "function", "class", "mixin",
  "factory", "extends", "implements", "import", "export", "from", "as", "async",
  "this", "super", "static", "public", "private", "protected", "readonly",
  "interface", "type", "enum", "abstract", "void", "dynamic", "in", "of",
  "true", "false", "null", "undefined",
]);

const TOKEN = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|r?(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|`(?:\\.|[^`\\])*`|0[xX][\da-fA-F]+|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|\s+|[{}[\]();,.:?]|[+\-*/%=<>!&|^~]+|./gy;

function highlight(code: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  let previous = "";
  TOKEN.lastIndex = 0;

  for (let match = TOKEN.exec(code); match; match = TOKEN.exec(code)) {
    const value = match[0];
    const next = code.slice(TOKEN.lastIndex).trimStart()[0] ?? "";
    let kind: TokenKind | null = null;

    if (value.startsWith("//") || value.startsWith("/*")) kind = "comment";
    else if (/^(?:r?["']|`)/.test(value)) kind = "string";
    else if (/^(?:0[xX][\da-fA-F]+|\d)/.test(value)) kind = "number";
    else if (/^[A-Za-z_$]/.test(value)) {
      if (CONTROL.has(value)) kind = "control";
      else if (KEYWORDS.has(value)) kind = "keyword";
      else if (previous === "." || next === ":") kind = "property";
      else if (next === "(") kind = "function";
      else if (/^[A-Z]/.test(value)) kind = "type";
    } else if (/^[{}[\]();,.:?]$/.test(value)) kind = "punctuation";

    pieces.push(kind ? <span key={match.index} style={{ color: COLORS[kind] }}>{value}</span> : value);
    if (value.trim()) previous = value.at(-1) ?? "";
  }

  return pieces;
}

export function SyntaxCode({ code, filePath }: { code: string; filePath: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre bg-canvas px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg-2">
      <code aria-label={`Suggested code for ${filePath}`}>{highlight(code)}</code>
    </pre>
  );
}
