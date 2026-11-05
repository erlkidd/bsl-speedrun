import { useRef, useState } from "react";
import { sandboxExamples } from "../lib/content.js";
import { runCode, progress } from "../lib/api.js";
import CodeEditor, { LspBadge } from "../components/CodeEditor.jsx";

const DEFAULT = sandboxExamples[0]?.code ?? 'Сообщить("Привет, BSL!");\n';

export default function Sandbox() {
  const [code, setCode] = useState(() => progress.draft("sandbox") ?? DEFAULT);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const editorApi = useRef(null);

  const onChange = (v) => { setCode(v); progress.saveDraft("sandbox", v); };

  async function run() {
    setBusy(true); setError("");
    try { setRes(await runCode(code)); } catch (e) { setError(e.message); setRes(null); }
    finally { setBusy(false); }
  }

  return (
    <div className="page sandbox">
      <h1>Песочница</h1>
      <p className="muted">Любой BSL-код на OneScript: коллекции, строки, даты, вывод через <code>Сообщить()</code>. Файлы, сеть и системные команды отключены, лимит — 5 секунд.</p>
      <div className="toolbar">
        <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Выполняю…" : "▶ Запустить"} <kbd>Ctrl+Enter</kbd></button>
        <button className="btn" onClick={() => editorApi.current?.format()}>Форматировать</button>
        <select className="btn" value="" onChange={(e) => { const ex = sandboxExamples.find((x) => x.id === e.target.value); if (ex) editorApi.current?.setValue(ex.code); }}>
          <option value="">Примеры…</option>
          {sandboxExamples.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
        <LspBadge />
      </div>
      <div className="split sandbox-split">
        <CodeEditor value={code} onChange={onChange} onRun={run} apiRef={editorApi} errors={res?.errors ?? []} minHeight={460} />
        <div className="out">
          <div className="out-head">
            Консоль
            {res && <span className="muted small">{res.phase === "guard" ? "заблокировано" : res.phase === "syntax" ? "синтаксис" : `${res.durationMs} мс`}{res.truncated ? " · вывод обрезан" : ""}</span>}
          </div>
          {error && <div className="alert">{error}</div>}
          {res?.errors?.length > 0 && <ul className="errs">{res.errors.map((e, i) => <li key={i}>{e.line > 0 && <b>Строка {e.line}: </b>}{e.message}</li>)}</ul>}
          <pre className="console">{res ? res.output || (res.ok ? "(пустой вывод)" : "") : "Нажми «Запустить»"}</pre>
        </div>
      </div>
    </div>
  );
}
