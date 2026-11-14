import { useState } from "react";
import { metadataTree } from "../lib/q1c/db.js";

const ROLE = { dim: "измерение", res: "ресурс", attr: "реквизит", std: "стандартное" };
/** Дерево метаданных виртуальной конфигурации. Клик вставляет имя в редактор. */
export default function MetaTree({ onInsert }) {
  const [open, setOpen] = useState(() => new Set(["Справочники"]));
  const toggle = (k) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const Fields = ({ fields }) => (
    <ul className="mt-fields">
      {fields.map((f) => <li key={f.n}><button onClick={() => onInsert?.(f.n)} title={`${ROLE[f.role]} · ${f.type}`}><i className={`dot r-${f.role}`} />{f.n}<span>{f.type.replace(/^(Справочник|Документ|Перечисление|ПланСчетов|ПланВидовРасчета|ПланВидовХарактеристик)Ссылка\./, "→ ")}</span></button></li>)}
    </ul>
  );
  return (
    <nav className="metatree" aria-label="Метаданные конфигурации">
      <div className="mt-title">Конфигурация «Барсик-Трейд»</div>
      {metadataTree.map((g) => (
        <div key={g.title} className="mt-group">
          <button className="mt-g" aria-expanded={open.has(g.title)} onClick={() => toggle(g.title)}>{open.has(g.title) ? "▾" : "▸"} {g.title} <span>{g.objects.length}</span></button>
          {open.has(g.title) && g.objects.map((o) => (
            <div key={o.name} className="mt-obj">
              <div className="mt-o">
                <button className="mt-caret" aria-expanded={open.has(o.name)} aria-label="Показать поля" onClick={() => toggle(o.name)}>{open.has(o.name) ? "▾" : "▸"}</button>
                <button className="mt-name" onClick={() => onInsert?.(o.name)} title={`${o.title} — вставить имя таблицы`}>{o.name.split(".").slice(1).join(".")}</button>
                {o.note && <span className="mt-note">{o.note}</span>}
              </div>
              {open.has(o.name) && (
                <div className="mt-body">
                  <Fields fields={o.fields} />
                  {o.tabular.map((t) => (
                    <div key={t.name}><button className="mt-sub" onClick={() => onInsert?.(t.name)}>▦ табличная часть {t.name.split(".").pop()}</button><Fields fields={t.fields} /></div>
                  ))}
                  {o.virtual.length > 0 && <div className="mt-virt">Виртуальные таблицы: {o.virtual.map((v) => <button key={v} onClick={() => onInsert?.(`${o.name}.${v}()`)}>{v}()</button>)}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </nav>
  );
}
