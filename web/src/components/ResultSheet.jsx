import { useState } from "react";
import { presentation } from "../lib/q1c/db.js";
import { plural } from "../lib/plural.js";

const ROWS = ["строка", "строки", "строк"];
const fmtNum = (v) => {
  const [int, frac] = (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 100 && !Number.isInteger(v * 100) ? 4 : 2).replace(/0+$/, "").replace(/\.$/, "")).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (frac ? "," + frac : "");
};
function Cell({ v }) {
  if (v === null) return <td className="c-null">NULL</td>;
  if (typeof v === "number") return <td className="c-num">{fmtNum(v)}</td>;
  if (typeof v === "boolean") return <td className="c-bool">{v ? "Да" : "Нет"}</td>;
  const ref = v && typeof v === "object" && !(v instanceof Date);
  return <td className={ref ? "c-ref" : ""} title={ref && v.__t ? v.__t.name : undefined}>{presentation(v)}</td>;
}

/** Результат запроса в виде «табличного документа», как в отчёте 1С. */
export function ResultSheet({ result, limit = 200 }) {
  if (!result) return null;
  const { columns, rows, levels, depth = 0 } = result;
  const shown = rows.slice(0, limit);
  return (
    <div className="sheet-wrap">
      <table className="sheet">
        <thead><tr><th className="rn">№</th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {shown.map((r, i) => {
            const lvl = levels ? levels[i] : null;
            const total = levels && lvl < depth;
            return (
              <tr key={i} className={total ? `total lvl-${lvl}` : ""}>
                <td className="rn">{total ? "Σ" : i + 1}</td>
                {r.map((v, j) => (v === undefined && total ? <td key={j} /> : <Cell key={j} v={v} />))}
              </tr>
            );
          })}
          {!rows.length && <tr><td className="empty" colSpan={columns.length + 1}>Запрос выполнен, но не вернул ни одной строки</td></tr>}
        </tbody>
      </table>
      <div className="sheet-foot">{plural(rows.length, ROWS)}{rows.length > limit ? `, показаны первые ${limit}` : ""} · {columns.length} кол.</div>
    </div>
  );
}

/** Результаты всего пакета: вкладка на каждый запрос, включая содержимое временных таблиц. */
export function BatchResult({ exec }) {
  const list = exec.results;
  const [tab, setTab] = useState(-1);
  const lastIdx = list.findLastIndex((r) => r.kind === "result");
  const cur = tab >= 0 && tab < list.length ? tab : lastIdx >= 0 ? lastIdx : list.length - 1;
  const r = list[cur];
  const label = (x, i) => (x.kind === "temp" ? `${i + 1}. ВТ ${x.name}` : x.kind === "drop" ? `${i + 1}. Уничтожить ${x.name}` : `${i + 1}. Результат`);
  return (
    <div className="batch">
      {list.length > 1 && (
        <div className="batch-tabs" role="tablist">
          {list.map((x, i) => <button key={i} role="tab" aria-selected={i === cur} className={`${i === cur ? "on" : ""} k-${x.kind}`} onClick={() => setTab(i)}>{label(x, i)}</button>)}
        </div>
      )}
      {r.kind === "temp" && <p className="batch-note">Временная таблица <b>{r.name}</b>: запрос ничего не вернул наружу, а сложил эти строки во временную таблицу. Следующие запросы пакета читают её по имени.</p>}
      {r.kind === "drop" ? <p className="batch-note">Временная таблица <b>{r.name}</b> уничтожена — дальше в пакете она недоступна.</p> : <ResultSheet result={r} />}
    </div>
  );
}
