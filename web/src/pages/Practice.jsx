import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { tasks } from "../lib/content.js";
import { progress } from "../lib/api.js";

export const Stars = ({ n }) => <span className="stars" title={`Сложность ${n}/3`}>{"●".repeat(n)}<i>{"●".repeat(3 - n)}</i></span>;

export default function Practice() {
  const solved = progress.solved();
  const [tag, setTag] = useState("");
  const tags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags ?? []))].sort(), []);
  const list = tag ? tasks.filter((t) => t.tags?.includes(tag)) : tasks;
  return (
    <div className="page">
      <h1>Практика</h1>
      <p className="muted">Решено {solved.size} из {tasks.length}. Код проверяется на сервере: синтаксис OneScript, правила задачи, тесты.</p>
      <div className="chips">
        <button className={!tag ? "chip on" : "chip"} onClick={() => setTag("")}>все</button>
        {tags.map((t) => <button key={t} className={tag === t ? "chip on" : "chip"} onClick={() => setTag(t)}>{t}</button>)}
      </div>
      <ol className="task-list">
        {list.map((t) => (
          <li key={t.id} className={solved.has(t.id) ? "done" : ""}>
            <Link to={`/practice/${t.id}`}>
              <span className="check">{solved.has(t.id) ? "✓" : ""}</span>
              <span className="t-title">{t.title}</span>
              <span className="t-tags">{t.tags?.join(" · ")}</span>
              <Stars n={t.difficulty ?? 1} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
