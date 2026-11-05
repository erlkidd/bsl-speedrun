import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTask, tasks } from "../lib/content.js";
import { checkTask, progress } from "../lib/api.js";
import CodeEditor, { LspBadge } from "../components/CodeEditor.jsx";
import Markdown, { highlightBsl } from "../components/Markdown.jsx";
import { Stars } from "./Practice.jsx";

export default function TaskPageRoute() {
  const { id } = useParams();
  const task = getTask(id);
  if (!task) return <div className="page"><h1>Задача не найдена</h1><Link to="/practice">К списку задач</Link></div>;
  return <TaskPage key={id} task={task} />;
}

function TaskPage({ task }) {
  const draftKey = `task:${task.id}`;
  const [code, setCode] = useState(() => progress.draft(draftKey) ?? task.starter);
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const editorApi = useRef(null);
  const idx = tasks.findIndex((t) => t.id === task.id);
  const next = tasks[idx + 1];

  const onChange = (v) => { setCode(v); progress.saveDraft(draftKey, v); };

  async function check() {
    setBusy(true); setError("");
    try {
      const r = await checkTask(task.id, code);
      setResult(r);
      if (r.passed) progress.markSolved(task.id);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const reset = () => { if (confirm("Вернуть заготовку? Текущий код пропадёт.")) editorApi.current?.setValue(task.starter); };

  return (
    <div className="page task">
      <div className="task-head">
        <Link to="/practice" className="muted">← Все задачи</Link>
        <h1>{task.title} <Stars n={task.difficulty ?? 1} /></h1>
      </div>
      <div className="split">
        <section className="statement">
          <Markdown text={task.statement} />
          {task.rules && (
            <ul className="rules">
              {task.rules.required?.map((r) => <li key={r.message}>✔ {r.message}</li>)}
              {task.rules.forbidden?.map((r) => <li key={r.message}>✘ {r.message}</li>)}
            </ul>
          )}
          <div className="hints">
            {task.hints?.slice(0, hints).map((h, i) => <div key={i} className="hint"><b>Подсказка {i + 1}.</b> <Markdown text={h} /></div>)}
            {hints < (task.hints?.length ?? 0) && <button className="btn ghost" onClick={() => setHints(hints + 1)}>Подсказка ({hints + 1}/{task.hints.length})</button>}
            {!showSolution
              ? <button className="btn ghost" onClick={() => setShowSolution(true)}>Показать решение</button>
              : <div className="solution"><b>Эталонное решение</b><pre className="code"><code dangerouslySetInnerHTML={{ __html: highlightBsl(task.solution) }} /></pre>
                  <button className="btn ghost" onClick={() => editorApi.current?.setValue(task.solution)}>Вставить в редактор</button></div>}
          </div>
        </section>
        <section className="work">
          <div className="toolbar">
            <button className="btn primary" disabled={busy} onClick={check}>{busy ? "Проверяю…" : "Проверить"} <kbd>Ctrl+Enter</kbd></button>
            <button className="btn" onClick={() => editorApi.current?.format()} title="Shift+Alt+F">Форматировать</button>
            <button className="btn ghost" onClick={reset}>Сброс</button>
            <LspBadge />
          </div>
          <CodeEditor value={code} onChange={onChange} onRun={check} apiRef={editorApi} errors={result?.errors ?? []} />
          {error && <div className="alert">{error}</div>}
          {result && <CheckResult r={result} next={next} />}
        </section>
      </div>
    </div>
  );
}

function CheckResult({ r, next }) {
  const stageText = { guard: "Код не прошёл проверку безопасности", syntax: "Синтаксическая ошибка", tests: r.passed ? "Задача решена!" : "Есть ошибки" }[r.stage];
  return (
    <div className={`result ${r.passed ? "ok" : "bad"}`}>
      <h3>{r.passed ? "✓ " : "✗ "}{stageText}</h3>
      {r.errors?.length > 0 && <ul className="errs">{r.errors.map((e, i) => <li key={i}>{e.line > 0 && <b>Строка {e.line}: </b>}{e.message}</li>)}</ul>}
      {r.rules?.length > 0 && <ul className="errs">{r.rules.map((x, i) => <li key={i}>Правило задачи: {x.message}</li>)}</ul>}
      {r.cases?.length > 0 && (
        <table className="cases">
          <thead><tr><th></th><th>Вызов</th><th>Ожидается</th><th>Получено</th></tr></thead>
          <tbody>{r.cases.map((c, i) => (
            <tr key={i} className={c.status === "PASS" ? "pass" : "fail"}>
              <td>{c.status === "PASS" ? "✓" : "✗"}</td><td><code>{c.name}</code></td><td><code>{c.expected}</code></td><td><code>{c.actual}</code></td>
            </tr>))}</tbody>
        </table>
      )}
      {r.output && <><div className="muted small">Вывод:</div><pre className="console">{r.output}</pre></>}
      {r.passed && next && <Link className="btn primary" to={`/practice/${next.id}`}>Следующая: {next.title} →</Link>}
    </div>
  );
}
