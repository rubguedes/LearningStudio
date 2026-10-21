import { useRef } from "react";
export function CodeEditor({
  value,
  onChange,
  disabled = false,
  label = "Seu código original",
}: {
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  label?: string;
}) {
  const preview = useRef<HTMLPreElement>(null);
  const parts = value.split(
    /(#[^\n]*|\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:def|return|if|else|for|in|raise|import|from|class|const|let|function|type|interface|throw|new|true|false|True|False|None|number|string|boolean)\b|\b\d+\b)/g,
  );
  return (
    <label>
      {label}
      <div className="code-editor">
        <pre ref={preview} aria-hidden="true">
          {parts.map((part, i) => (
            <span
              key={i}
              className={
                /^(#|\/\/)/.test(part)
                  ? "syntax-comment"
                  : /^['"]/.test(part)
                    ? "syntax-string"
                    : /^\d+$/.test(part)
                      ? "syntax-number"
                      : /^\w+$/.test(part)
                        ? "syntax-keyword"
                        : undefined
              }
            >
              {part}
            </span>
          ))}
          {"\n"}
        </pre>
        <textarea
          aria-label={label}
          rows={15}
          maxLength={30000}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (preview.current) {
              preview.current.scrollTop = e.currentTarget.scrollTop;
              preview.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        />
      </div>
    </label>
  );
}
