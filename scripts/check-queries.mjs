// Проверка контента по запросам на учебном движке (без сервера и браузера):
//   node scripts/check-queries.mjs
// 1) уровни игры  2) задачи content/queries  3) примеры ```query из базы знаний и консоли.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { allLevels } from "../web/src/game/levels.js";
import { checkAnswer, run, referenceText, fillTemplate } from "../web/src/lib/q1c/check.js";
import { paramNames } from "../web/src/lib/q1c/engine.js";
import { examples, guessParam } from "../web/src/lib/q1c/examples.js";

const yaml = createRequire(new URL("../web/package.json", import.meta.url))("js-yaml");
const root = new URL("../content/", import.meta.url);
let bad = 0;
const fail = (...a) => { bad++; console.log("FAIL", ...a); };

// ---- игра ----
for (const l of allLevels) {
  const ref = run(referenceText(l), l.params);
  if (!ref.ok) { fail("игра", l.id, ref.error.message); continue; }
  if (l.type === "read") { if (l.verify(ref.exec) !== l.options[l.correct]) fail("игра", l.id, "верный вариант не совпадает с результатом запроса:", l.verify(ref.exec)); continue; }
  if (!checkAnswer(l, referenceText(l)).ok) fail("игра", l.id, "эталон не проходит собственную проверку");
  if (!ref.exec.last?.rows.length) fail("игра", l.id, "эталон возвращает пустой результат");
  if (l.starter !== undefined && checkAnswer(l, l.starter).ok) fail("игра", l.id, "заготовка уже проходит проверку");
  if (l.type === "fill" && checkAnswer(l, fillTemplate(l.template, l.pool)).ok) fail("игра", l.id, "неверные слова проходят проверку");
}
console.log(`игра: ${allLevels.length} головоломок`);

// ---- задачи на запросы ----
let tasks = 0; const ids = new Set();
for (const f of readdirSync(new URL("queries/", root)).sort()) {
  for (const t of yaml.load(readFileSync(new URL(`queries/${f}`, root), "utf8")).tasks) {
    tasks++;
    if (ids.has(t.id)) fail("задача", t.id, "повтор идентификатора");
    ids.add(t.id);
    const spec = { type: "write", ...t };
    const c = checkAnswer(spec, t.solution);
    if (!c.ok) fail("задача", t.id, c.why);
    else if (!c.exec.last.rows.length) fail("задача", t.id, "эталон возвращает пустой результат");
    if (checkAnswer(spec, t.starter ?? "").ok) fail("задача", t.id, "заготовка уже проходит проверку");
  }
}
console.log(`задачи на запросы: ${tasks}`);

// ---- примеры ----
let ex = 0;
const tryRun = (text, where) => {
  ex++;
  const r = run(text, Object.fromEntries(paramNames(text).map((n) => [n, guessParam(n)])));
  if (!r.ok) fail("пример", where, `строка ${r.error.line}: ${r.error.message}`);
};
for (const f of readdirSync(new URL("kb/queries/", root))) for (const m of readFileSync(new URL(`kb/queries/${f}`, root), "utf8").matchAll(/```query\n([\s\S]*?)```/g)) tryRun(m[1], f);
examples.forEach((e) => tryRun(e.text, `консоль: ${e.title}`));
console.log(`примеры: ${ex}`);

console.log(bad ? `\nОшибок: ${bad}` : "\nВсё в порядке");
process.exit(bad ? 1 : 0);
