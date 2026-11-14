import { useMemo, useRef, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { queryTopics, queryTasks, getQueryTask } from "../lib/content.js";
import { progress, bump, useStore } from "../lib/store.js";
import { paramNames } from "../lib/q1c/engine.js";
import { run, checkAnswer } from "../lib/q1c/check.js";
import { examples, guessParam } from "../lib/q1c/examples.js";
import { highlightQuery } from "../lib/q1c/highlight.js";
import QueryEditor from "../components/QueryEditor.jsx";
import MetaTree from "../components/MetaTree.jsx";
import { BatchResult, ResultSheet } from "../components/ResultSheet.jsx";
import Markdown from "../components/Markdown.jsx";
import { Stars } from "./Practice.jsx";
import { plural, TASKS } from "../lib/plural.js";

const SubNav = () => (
  <div className="subnav">
    <NavLink to="/queries" end>Консоль запросов</NavLink>
    <NavLink to="/queries/tasks">Задачи на запросы</NavLink>
  </div>
);

export const QueryCode = ({ text }) => <pre className="code"><code dangerouslySetInnerHTML={{ __html: highlightQuery(text) }} /></pre>;

/** Поля ввода параметров &Имя, найденных в тексте. */
function ParamsPanel({ names, values, onChange, locked }) {
  if (!names.length) return null;
  return (
    <div className="params">
      <b>Параметры</b>
      {names.map((n) => (
        <label key={n}><span>&amp;{n}</span>
          <input value={values[n] ?? ""} readOnly={locked} onChange={(e) => onChange({ ...values, [n]: e.target.value })} placeholder="значение" spellCheck={false} />
        </label>
      ))}
      {!locked && <small className="muted">Дата: <code>31.03.2026</code> · число: <code>100</code> · строка: <code>"текст"</code> · ссылка: <code>Справочник.Склады.Основной</code> · список: через <code>;</code></small>}
    </div>
  );
}
const ErrorBox = ({ error }) => <div className="alert"><b>Ошибка в строке {error.line}, позиция {error.col}.</b> {error.message}</div>;

export function QueryConsole() {
  const [text, setText] = useState(() => progress.draft("qconsole") ?? examples[0].text);
  const [values, setValues] = useState(() => progress.draft("qconsole:params") ?? {});
  const [res, setRes] = useState(null);
  const ed = useRef(null);
  const names = useMemo(() => paramNames(text), [text]);
  const filled = useMemo(() => Object.fromEntries(names.map((n) => [n, values[n] ?? guessParam(n)])), [names, values]);

  const onChange = (v) => { setText(v); progress.saveDraft("qconsole", v); };
  const onParams = (v) => { setValues(v); progress.saveDraft("qconsole:params", v); };
  function execute() {
    const missing = names.find((n) => !String(filled[n]).trim());
    if (missing) { setRes({ ok: false, error: { line: 1, col: 1, message: `Заполни значение параметра &${missing}` } }); return; }
    let r;
    try { r = run(text, filled); } catch (e) { r = { ok: false, error: { line: 1, col: 1, message: e.message } }; }
    setRes(r);
    if (r.ok) {
      bump("consoleRuns");
      if (r.exec.results.some((x) => x.kind === "temp")) bump("tempTables");
      if (/\.(Остатки|Обороты|ОстаткиИОбороты|СрезПоследних|СрезПервых|ОборотыДтКт)\s*\(/iu.test(text)) bump("virtualTables");
    }
  }

  return (
    <div className="page">
      <h1>Запросы</h1>
      <SubNav />
      <p className="muted">Учебная база «Барсик-Трейд»: справочники, документы и четыре вида регистров. Пиши запросы на языке 1С — результат выводится табличным документом. Слева — дерево метаданных, клик вставляет имя в текст.</p>
      <div className="qlayout">
        <MetaTree onInsert={(t) => ed.current?.insert(t)} />
        <section className="qwork">
          <div className="toolbar">
            <button className="btn primary" onClick={execute}>Выполнить <kbd>Ctrl+Enter</kbd></button>
            <select className="btn" value="" onChange={(e) => { if (e.target.value !== "") { onChange(examples[+e.target.value].text); setRes(null); } }} aria-label="Примеры запросов">
              <option value="">Примеры…</option>
              {examples.map((x, i) => <option key={x.title} value={i}>{x.title}</option>)}
            </select>
            <button className="btn ghost" onClick={() => { onChange(""); setRes(null); ed.current?.focus(); }}>Очистить</button>
          </div>
          <QueryEditor value={text} onChange={onChange} onRun={execute} apiRef={ed} errorLine={res && !res.ok ? res.error.line : 0} minRows={12} />
          <ParamsPanel names={names} values={filled} onChange={onParams} />
          {res && !res.ok && <ErrorBox error={res.error} />}
          {res?.ok && <BatchResult exec={res.exec} />}
        </section>
      </div>
    </div>
  );
}

export function QueryTaskList() {
  useStore();
  const solved = progress.queries();
  return (
    <div className="page">
      <h1>Запросы</h1>
      <SubNav />
      <p className="muted">Решено {solved.size} из {plural(queryTasks.length, TASKS)}. Проверка честная: твой запрос и эталон выполняются на одной базе, результаты сравниваются.</p>
      {queryTopics.map((t) => (
        <section key={t.id} className="kb-section">
          <h2>{t.topic} {t.kb && <Link className="small muted" to={`/kb/${t.kb}`}>теория →</Link>}</h2>
          <ol className="task-list">
            {t.tasks.map((x) => (
              <li key={x.id} className={solved.has(x.id) ? "done" : ""}>
                <Link to={`/queries/tasks/${x.id}`}>
                  <span className="check">{solved.has(x.id) ? "✓" : ""}</span>
                  <span className="t-title">{x.title}</span>
                  <span className="t-tags">{x.ordered ? "порядок строк важен" : ""}</span>
                  <Stars n={x.difficulty ?? 1} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function QueryTaskRoute() {
  const { id } = useParams();
  const task = getQueryTask(id);
  if (!task) return <div className="page"><h1>Задача не найдена</h1><Link to="/queries/tasks">К списку задач</Link></div>;
  return <QueryTask key={id} task={task} />;
}

function QueryTask({ task }) {
  const draftKey = `q:${task.id}`;
  const [text, setText] = useState(() => progress.draft(draftKey) ?? task.starter ?? "");
  const [hints, setHints] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [res, setRes] = useState(null); // {mode:"run"|"check", ...}
  const ed = useRef(null);
  const idx = queryTasks.findIndex((t) => t.id === task.id);
  const next = queryTasks[idx + 1];
  const names = Object.keys(task.params ?? {});

  const onChange = (v) => { setText(v); progress.saveDraft(draftKey, v); };
  const justRun = () => setRes({ mode: "run", ...run(text, task.params) });
  function check() {
    const r = checkAnswer(task, text);
    setRes({ mode: "check", ...r });
    if (r.ok) progress.markQuery(task.id);
  }

  return (
    <div className="page task">
      <div className="task-head">
        <Link to="/queries/tasks" className="muted">← Все задачи на запросы</Link>
        <h1>{task.title} <Stars n={task.difficulty ?? 1} /></h1>
      </div>
      <div className="split">
        <section className="statement">
          <p className="eyebrow">{task.topic}</p>
          <Markdown text={task.text} />
          {(task.require || task.forbid || task.ordered) && (
            <ul className="rules">
              {task.ordered && <li>✔ Порядок строк результата проверяется</li>}
              {task.require?.map((r) => <li key={r.message}>✔ {r.message}</li>)}
              {task.forbid?.map((r) => <li key={r.message}>✘ {r.message}</li>)}
            </ul>
          )}
          <div className="hints">
            {task.hints?.slice(0, hints).map((h, i) => <div key={i} className="hint"><b>Подсказка {i + 1}.</b> <Markdown text={h} /></div>)}
            {hints < (task.hints?.length ?? 0) && <button className="btn ghost" onClick={() => setHints(hints + 1)}>Подсказка ({hints + 1}/{task.hints.length})</button>}
            {!showSolution
              ? <button className="btn ghost" onClick={() => setShowSolution(true)}>Показать решение</button>
              : <div className="solution"><b>Эталонное решение</b><QueryCode text={task.solution} /></div>}
            <button className="btn ghost" onClick={() => setShowTree(!showTree)}>{showTree ? "Скрыть метаданные" : "Метаданные конфигурации"}</button>
          </div>
          {showTree && <MetaTree onInsert={(t) => ed.current?.insert(t)} />}
        </section>
        <section className="work">
          <div className="toolbar">
            <button className="btn primary" onClick={check}>Проверить <kbd>Ctrl+Enter</kbd></button>
            <button className="btn" onClick={justRun}>Просто выполнить</button>
            <button className="btn ghost" onClick={() => { if (confirm("Вернуть заготовку? Текущий текст пропадёт.")) onChange(task.starter ?? ""); }}>Сброс</button>
          </div>
          <QueryEditor value={text} onChange={onChange} onRun={check} apiRef={ed} errorLine={res?.error?.line ?? 0} minRows={10} />
          <ParamsPanel names={names} values={task.params ?? {}} locked />
          {res?.error && <ErrorBox error={res.error} />}
          {res?.mode === "check" && !res.error && (
            <div className={`result ${res.ok ? "ok" : "bad"}`}>
              <h3>{res.ok ? "Решено — результат совпал с эталоном" : "Пока не то"}</h3>
              {!res.ok && <p>{res.why}</p>}
              {res.ok && next && <Link className="btn primary" to={`/queries/tasks/${next.id}`}>Следующая задача →</Link>}
            </div>
          )}
          {res?.exec && <><h4 className="sheet-title">Твой результат</h4><BatchResult exec={res.exec} /></>}
          {res?.mode === "check" && !res.ok && res.expected && (
            <details className="expected"><summary>Показать ожидаемый результат</summary><ResultSheet result={res.expected} /></details>
          )}
        </section>
      </div>
    </div>
  );
}
