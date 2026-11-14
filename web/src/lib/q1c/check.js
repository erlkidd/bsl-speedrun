// Автопроверка запросов: выполняем ответ и эталон на одной и той же базе и сравниваем результаты.
import { execute, parseValue, sameResult, lineCol, QueryError } from "./engine.js";

export function resolveParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === "string" ? parseValue(v) : v;
  return out;
}

/** Выполнить текст; ошибки возвращаются как данные, а не исключением. */
export function run(text, params = {}) {
  try {
    return { ok: true, exec: execute(text, resolveParams(params)) };
  } catch (e) {
    if (!(e instanceof QueryError)) throw e;
    const { line, col } = lineCol(text, e.pos);
    return { ok: false, error: { message: e.message, line, col, pos: e.pos } };
  }
}

export const fillTemplate = (template, words) => template.replace(/\{\{(\d+)\}\}/g, (_, i) => words[+i] ?? "___");
const stripComments = (s) => s.replace(/\/\/[^\n]*/g, "");

/** Эталонный текст задачи любого типа. */
export function referenceText(spec) {
  if (spec.type === "fill") return fillTemplate(spec.template, spec.answers);
  if (spec.type === "order") return spec.lines.join("\n");
  if (spec.type === "read") return spec.query;
  return spec.solution;
}

/** Проверка ответа-запроса. Возвращает {ok, why, exec, error, expected}. */
export function checkAnswer(spec, text) {
  const mine = run(text, spec.params);
  if (!mine.ok) return { ok: false, error: mine.error, why: `Ошибка в строке ${mine.error.line}: ${mine.error.message}` };
  const ref = run(referenceText(spec), spec.params);
  if (!ref.ok) return { ok: false, exec: mine.exec, why: "Эталон задачи не выполнился — сообщи об этом автору" };
  const clean = stripComments(text);
  for (const r of spec.require ?? []) if (!new RegExp(r.pattern, "iu").test(clean)) return { ok: false, exec: mine.exec, expected: ref.exec.last, why: r.message };
  for (const r of spec.forbid ?? []) if (new RegExp(r.pattern.replace(/\\b/g, "(?<![\\p{L}\\p{N}_])").replace(/\(\?<!\[\\p\{L\}\\p\{N\}_\]\)$/, "(?![\\p{L}\\p{N}_])"), "iu").test(clean)) return { ok: false, exec: mine.exec, expected: ref.exec.last, why: r.message };
  if (!mine.exec.last) return { ok: false, exec: mine.exec, expected: ref.exec.last, why: "Последний запрос пакета должен вернуть результат (без ПОМЕСТИТЬ)" };
  const cmp = sameResult(mine.exec.last, ref.exec.last, { ordered: !!spec.ordered, names: !!spec.names });
  return { ok: cmp.ok, why: cmp.why, exec: mine.exec, expected: ref.exec.last };
}
