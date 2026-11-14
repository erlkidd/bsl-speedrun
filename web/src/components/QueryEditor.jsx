import { useRef } from "react";
import { highlightQuery } from "../lib/q1c/highlight.js";

/** Лёгкий редактор запросов: textarea поверх подсвеченного слоя. Ctrl+Enter — выполнить, Tab — отступ. */
export default function QueryEditor({ value, onChange, onRun, errorLine = 0, minRows = 8, apiRef, autoFocus = false }) {
  const ta = useRef(null);
  const back = useRef(null);
  const lines = Math.max(minRows, value.split("\n").length + 1);

  const insert = (text) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(value.slice(0, a) + text + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + text.length; });
  };
  if (apiRef) apiRef.current = { insert, focus: () => ta.current?.focus() };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun?.(); return; }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); insert("    "); return; }
    if (e.key === "Enter") { // сохранить отступ текущей строки
      const el = e.target; const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
      const indent = value.slice(start, el.selectionStart).match(/^[ \t]*/)[0];
      if (indent) { e.preventDefault(); insert("\n" + indent); }
    }
  };
  const syncScroll = (e) => { if (back.current) { back.current.scrollTop = e.target.scrollTop; back.current.scrollLeft = e.target.scrollLeft; } };

  return (
    <div className="qed" style={{ "--rows": lines }}>
      <pre ref={back} className="qed-back" aria-hidden="true">
        {errorLine > 0 && <i className="qed-err" style={{ top: `calc(${errorLine - 1} * var(--lh) + 12px)` }} />}
        <code dangerouslySetInnerHTML={{ __html: highlightQuery(value) + "\n" }} />
      </pre>
      <textarea ref={ta} className="qed-ta" value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoFocus={autoFocus} aria-label="Текст запроса"
        onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} onScroll={syncScroll} />
    </div>
  );
}
