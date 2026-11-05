import { useEffect, useRef, useState } from "react";
import monaco from "../lib/monaco.js";
import { prefersDark } from "../lib/bsl-language.js";
import { attachLsp, onLspStatus } from "../lib/lsp.js";

let seq = 0;

/**
 * props: value, onChange, errors [{line, message}] — ошибки сервера (синтаксис/запуск),
 *        onRun — Ctrl+Enter, apiRef — получить {format(), setValue()}
 */
export default function CodeEditor({ value, onChange, errors = [], onRun, apiRef, minHeight = 360 }) {
  const host = useRef(null);
  const ed = useRef(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    const uri = monaco.Uri.parse(`file:///sandbox/${Date.now().toString(36)}-${++seq}/Module.bsl`);
    const model = monaco.editor.createModel(value ?? "", "bsl", uri);
    const editor = monaco.editor.create(host.current, {
      model,
      theme: prefersDark() ? "bsl-dark" : "bsl-light",
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSize: 14,
      lineHeight: 21,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: false,
      renderWhitespace: "none",
      padding: { top: 12, bottom: 12 },
      fixedOverflowWidgets: true,
      wordBasedSuggestions: "off",
    });
    ed.current = editor;
    const sub = model.onDidChangeContent(() => onChangeRef.current?.(model.getValue()));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current?.());
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () =>
      editor.getAction("editor.action.formatDocument")?.run(),
    );
    const detach = attachLsp(monaco, model);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onScheme = () => monaco.editor.setTheme(mq.matches ? "bsl-dark" : "bsl-light");
    mq?.addEventListener?.("change", onScheme);
    if (apiRef) {
      apiRef.current = {
        format: () => editor.getAction("editor.action.formatDocument")?.run(),
        setValue: (v) => editor.executeEdits("api", [{ range: model.getFullModelRange(), text: v }]),
        focus: () => editor.focus(),
      };
    }
    return () => {
      mq?.removeEventListener?.("change", onScheme);
      detach();
      sub.dispose();
      editor.dispose();
      model.dispose();
    };
  }, []);

  // ошибки с сервера (oscript) — отдельный владелец маркеров
  useEffect(() => {
    const model = ed.current?.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, "oscript", errors
      .filter((e) => e.line > 0 && e.line <= model.getLineCount())
      .map((e) => ({
        startLineNumber: e.line, endLineNumber: e.line, startColumn: 1, endColumn: model.getLineMaxColumn(e.line),
        message: e.message, severity: monaco.MarkerSeverity.Error, source: "OneScript",
      })));
  }, [errors]);

  return <div className="editor" ref={host} style={{ minHeight }} />;
}

export function LspBadge() {
  const [s, setS] = useState("off");
  useEffect(() => onLspStatus(setS), []);
  const text = { ready: "BSL LS подключён", connecting: "BSL LS: подключение…", off: "BSL LS недоступен" }[s];
  return <span className={`lsp-badge lsp-${s}`} title="Линтер, автодополнение и подсказки — BSL Language Server">{text}</span>;
}
