// Загрузка задач из content/tasks и генерация проверочного кода (харнесса) на BSL.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const CONTENT = process.env.CONTENT_DIR || join(here, "../../content");
const HARNESS = readFileSync(join(here, "../runtime/harness.os"), "utf8");

const tasks = new Map();

export function loadTasks() {
  tasks.clear();
  const dir = join(CONTENT, "tasks");
  if (!existsSync(dir)) return tasks;
  for (const id of readdirSync(dir)) {
    const metaFile = join(dir, id, "meta.yaml");
    if (!existsSync(metaFile)) continue;
    const meta = yaml.load(readFileSync(metaFile, "utf8"));
    tasks.set(id, { id, ...meta });
  }
  return tasks;
}

export const getTask = (id) => tasks.get(id);

// ---------- JS-значение из YAML → BSL ----------
const bslString = (s) => '"' + String(s).replace(/"/g, '""').replace(/\r?\n/g, '"\n|') + '"';

/**
 * Возвращает {pre: string[], expr: string}: подготовительные операторы и выражение.
 * Поддержка: число, строка, булево, null, массив → Массив, объект → Структура,
 * {$map: [[k, v], ...]} → Соответствие, {$date: "2024-01-31T10:00:00"} → Дата, {$bsl: "выражение"}.
 */
function toBsl(v, ctx) {
  if (v === null || v === undefined) return "Неопределено";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "Истина" : "Ложь";
  if (typeof v === "string") return bslString(v);
  if (Array.isArray(v)) {
    const name = `_З${ctx.n++}`;
    ctx.pre.push(`${name} = Новый Массив;`);
    for (const e of v) ctx.pre.push(`${name}.Добавить(${toBsl(e, ctx)});`);
    return name;
  }
  if (typeof v === "object") {
    if ("$bsl" in v) return v.$bsl;
    if ("$date" in v) {
      const d = new Date(v.$date + (String(v.$date).length <= 10 ? "T00:00:00Z" : "Z"));
      const p = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
      return `Дата(${p.join(", ")})`;
    }
    if ("$map" in v) {
      const name = `_З${ctx.n++}`;
      ctx.pre.push(`${name} = Новый Соответствие;`);
      for (const [k, val] of v.$map) ctx.pre.push(`${name}.Вставить(${toBsl(k, ctx)}, ${toBsl(val, ctx)});`);
      return name;
    }
    const name = `_З${ctx.n++}`;
    ctx.pre.push(`${name} = Новый Структура;`);
    for (const [k, val] of Object.entries(v)) ctx.pre.push(`${name}.Вставить(${bslString(k)}, ${toBsl(val, ctx)});`);
    return name;
  }
  throw new Error("Неподдерживаемое значение в тесте: " + JSON.stringify(v));
}

export function displayValue(v) {
  if (v === null || v === undefined) return "Неопределено";
  if (typeof v === "boolean") return v ? "Истина" : "Ложь";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map(displayValue).join(", ")}]`;
  if ("$date" in v) return `'${v.$date}'`;
  if ("$bsl" in v) return v.$bsl;
  if ("$map" in v) return `{${v.$map.map(([k, x]) => `${displayValue(k)}: ${displayValue(x)}`).join(", ")}}`;
  return `{${Object.entries(v).map(([k, x]) => `${k}: ${displayValue(x)}`).join(", ")}}`;
}

/** Код ученика + служебные методы + тело с вызовами. */
export function buildHarness(task, userCode) {
  const ctx = { pre: [], n: 0 };
  const body = [];
  const cases = task.cases ?? [];
  cases.forEach((c, i) => {
    ctx.pre = [];
    const args = (c.args ?? []).map((a) => toBsl(a, ctx));
    const call = c.call ?? `${task.function}(${args.join(", ")})`;
    const expected = toBsl(c.expected, ctx);
    const name = c.name ?? `${task.function}(${(c.args ?? []).map(displayValue).join(", ")})`;
    body.push(
      `// кейс ${i + 1}`,
      ...ctx.pre, // подготовка литералов (не падает) — до Попытка, чтобы ожидание было доступно в Исключение
      "Попытка",
      `\t_Проверить(${bslString(name)}, ${call}, ${expected});`,
      "Исключение",
      `\t_Ошибка(${bslString(name)}, ${expected}, КраткоеПредставлениеОшибки(ИнформацияОбОшибке()));`,
      "КонецПопытки;",
    );
  });
  return `${userCode}\n${HARNESS}\n${body.join("\n")}\n`;
}

/** Разбор вывода харнесса. */
export function parseCases(output) {
  const cases = [];
  const rest = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("##CASE##")) {
      const [, status, name, expected, actual] = line.split("\t");
      cases.push({ status, name, expected, actual });
    } else rest.push(line);
  }
  return { cases, stdout: rest.join("\n").trim() };
}

/** Для задач с mode: output — сравнение вывода. */
export function compareOutput(actual, expected) {
  const norm = (s) => String(s).replace(/\r/g, "").split("\n").map((l) => l.trimEnd()).join("\n").trim();
  return norm(actual) === norm(expected);
}
