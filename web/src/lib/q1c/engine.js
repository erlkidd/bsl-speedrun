// Учебный движок языка запросов 1С: разбор текста → выполнение над виртуальной конфигурацией (db.js).
// Поддерживается синтаксис и логика запросов; это не копия платформы, а её обрезанная модель.
import { getTable, norm, predefined, presentation, typeOf, D } from "./db.js";

export class QueryError extends Error {
  constructor(message, pos) { super(message); this.pos = pos; }
}
const fail = (m, pos) => { throw new QueryError(m, pos); };

// ======================= лексер =======================
const KEYWORDS = new Set("ВЫБРАТЬ ИЗ ГДЕ КАК ПО И ИЛИ НЕ В СОЕДИНЕНИЕ ЛЕВОЕ ПРАВОЕ ПОЛНОЕ ВНУТРЕННЕЕ ВНЕШНЕЕ СГРУППИРОВАТЬ ИМЕЮЩИЕ УПОРЯДОЧИТЬ ОБЪЕДИНИТЬ ПОМЕСТИТЬ ИТОГИ ИНДЕКСИРОВАТЬ ВЫБОР КОГДА ТОГДА ИНАЧЕ КОНЕЦ МЕЖДУ ПОДОБНО ЕСТЬ ССЫЛКА ВОЗР УБЫВ ВСЕ РАЗЛИЧНЫЕ ПЕРВЫЕ РАЗРЕШЕННЫЕ УНИЧТОЖИТЬ ДЛЯ ИЕРАРХИИ АВТОУПОРЯДОЧИВАНИЕ ОБЩИЕ NULL ИСТИНА ЛОЖЬ НЕОПРЕДЕЛЕНО".split(" "));
const AGG = new Set(["СУММА", "КОЛИЧЕСТВО", "МАКСИМУМ", "МИНИМУМ", "СРЕДНЕЕ"]);

function lex(src) {
  const out = [];
  const re = /(\/\/[^\n]*)|(\s+)|("(?:[^"]|"")*")|(&[\p{L}_][\p{L}\p{N}_]*)|(\d+(?:\.\d+)?)|([\p{L}_][\p{L}\p{N}_]*)|(<>|<=|>=|[()*,.;+\-\/=<>])|(.)/gu;
  let m;
  while ((m = re.exec(src))) {
    const pos = m.index;
    if (m[1] || m[2]) continue;
    if (m[3]) out.push({ t: "str", v: m[3].slice(1, -1).replace(/""/g, '"'), pos });
    else if (m[4]) out.push({ t: "param", v: m[4].slice(1), pos });
    else if (m[5]) out.push({ t: "num", v: Number(m[5]), pos });
    else if (m[6]) out.push({ t: "id", v: m[6], u: norm(m[6]), pos });
    else if (m[7]) out.push({ t: "sym", v: m[7], u: m[7], pos });
    else fail(m[8] === '"' ? "Незакрытая строка: не хватает кавычки" : `Неожиданный символ «${m[8]}»`, pos);
  }
  out.push({ t: "eof", v: "конец текста", u: "", pos: src.length });
  return out;
}

// ======================= парсер =======================
class Parser {
  constructor(src) { this.src = src; this.toks = lex(src); this.i = 0; }
  get tok() { return this.toks[this.i]; }
  peek(n = 1) { return this.toks[Math.min(this.i + n, this.toks.length - 1)]; }
  is(...kw) { return (this.tok.t === "id" || this.tok.t === "sym") && kw.includes(this.tok.u); }
  eat(...kw) { if (this.is(...kw)) { this.i++; return true; } return false; }
  expect(kw, what) { if (!this.eat(kw)) fail(`Здесь ожидается ${what ?? `«${kw}»`}, а встретилось «${this.tok.v}»`, this.tok.pos); }
  ident(what = "имя") {
    if (this.tok.t !== "id") fail(`Здесь ожидается ${what}, а встретилось «${this.tok.v}»`, this.tok.pos);
    return this.toks[this.i++].v;
  }

  batch() {
    const list = [];
    while (this.tok.t !== "eof") {
      if (this.eat(";")) continue;
      const start = this.tok.pos;
      const q = this.query();
      q.text = this.src.slice(start, this.tok.pos).trim();
      list.push(q);
      if (this.tok.t !== "eof") this.expect(";", "«;» между запросами пакета");
    }
    if (!list.length) fail("Текст запроса пуст", 0);
    return list;
  }

  query() {
    if (this.eat("УНИЧТОЖИТЬ")) return { drop: this.ident("имя временной таблицы") };
    const q = { selects: [this.select()], all: [], order: [], totals: null };
    while (this.eat("ОБЪЕДИНИТЬ")) { q.all.push(this.eat("ВСЕ")); q.selects.push(this.select()); }
    for (;;) {
      if (this.eat("УПОРЯДОЧИТЬ")) {
        this.expect("ПО");
        do { const e = this.expr(); const desc = this.eat("УБЫВ"); if (!desc) this.eat("ВОЗР"); q.order.push({ e, desc }); } while (this.eat(","));
      } else if (this.eat("АВТОУПОРЯДОЧИВАНИЕ")) { /* не влияет на учебный результат */
      } else if (this.eat("ИНДЕКСИРОВАТЬ")) {
        this.expect("ПО"); q.index = [];
        do { q.index.push(this.expr()); } while (this.eat(","));
      } else if (this.eat("ИТОГИ")) {
        q.totals = { aggs: [], by: [], overall: false };
        if (!this.is("ПО")) do { const e = this.expr(); const alias = this.alias(); q.totals.aggs.push({ e, alias }); } while (this.eat(","));
        this.expect("ПО");
        do { if (this.eat("ОБЩИЕ")) q.totals.overall = true; else q.totals.by.push(this.expr()); } while (this.eat(","));
      } else break;
    }
    return q;
  }

  alias() {
    if (this.eat("КАК")) return this.ident("псевдоним после КАК");
    if (this.tok.t === "id" && !KEYWORDS.has(this.tok.u)) return this.ident();
    return null;
  }

  select() {
    const pos = this.tok.pos;
    this.expect("ВЫБРАТЬ", "ключевое слово ВЫБРАТЬ");
    const s = { pos, distinct: false, top: null, fields: [], into: null, from: [], where: null, group: null, having: null };
    for (;;) {
      if (this.eat("РАЗРЕШЕННЫЕ")) continue;
      if (this.eat("РАЗЛИЧНЫЕ")) { s.distinct = true; continue; }
      if (this.eat("ПЕРВЫЕ")) { if (this.tok.t !== "num") fail("После ПЕРВЫЕ нужно число", this.tok.pos); s.top = this.toks[this.i++].v; continue; }
      break;
    }
    do { const p = this.tok.pos; const e = this.expr(); s.fields.push({ e, alias: e.k === "star" ? null : this.alias(), pos: p }); } while (this.eat(","));
    if (this.eat("ПОМЕСТИТЬ")) s.into = this.ident("имя временной таблицы");
    if (this.eat("ИЗ")) do { s.from.push(this.source()); } while (this.eat(","));
    if (this.eat("ГДЕ")) s.where = this.expr();
    if (this.eat("СГРУППИРОВАТЬ")) { this.expect("ПО"); s.group = []; do { s.group.push(this.expr()); } while (this.eat(",")); }
    if (this.eat("ИМЕЮЩИЕ")) s.having = this.expr();
    if (this.eat("ДЛЯ")) { this.ident(); while (this.tok.t === "id" && !this.is("ОБЪЕДИНИТЬ", "УПОРЯДОЧИТЬ", "ИТОГИ", "ИНДЕКСИРОВАТЬ")) this.i++; }
    return s;
  }

  source() {
    let node = this.tableRef();
    for (;;) {
      let type = null;
      if (this.eat("ЛЕВОЕ")) type = "left"; else if (this.eat("ПРАВОЕ")) type = "right"; else if (this.eat("ПОЛНОЕ")) type = "full"; else if (this.eat("ВНУТРЕННЕЕ")) type = "inner";
      if (type) this.eat("ВНЕШНЕЕ");
      if (!type && !this.is("СОЕДИНЕНИЕ")) break;
      this.expect("СОЕДИНЕНИЕ", "слово СОЕДИНЕНИЕ");
      const right = this.tableRef();
      if (!this.is("ПО")) fail("У соединения нет условия: ожидалось ПО <условие>", this.tok.pos);
      this.i++;
      node = { k: "join", type: type ?? "inner", left: node, right, on: this.expr() };
    }
    return node;
  }

  tableRef() {
    const pos = this.tok.pos;
    if (this.eat("(")) {
      if (!this.is("ВЫБРАТЬ")) fail("В скобках после ИЗ ожидался вложенный запрос (ВЫБРАТЬ …)", this.tok.pos);
      const sub = this.query();
      this.expect(")");
      const alias = this.alias();
      if (!alias) fail("Вложенному запросу нужен псевдоним: (ВЫБРАТЬ …) КАК Имя", this.tok.pos);
      return { k: "table", sub, alias, pos };
    }
    const path = [this.ident("имя таблицы")];
    while (this.eat(".")) path.push(this.ident("часть имени таблицы"));
    let params = null;
    if (this.eat("(")) {
      params = [];
      if (!this.eat(")")) {
        for (;;) {
          params.push(this.is(",") || this.is(")") ? null : this.expr());
          if (this.eat(")")) break;
          this.expect(",", "«,» или «)» в параметрах виртуальной таблицы");
        }
      }
    }
    return { k: "table", path, params, alias: this.alias(), pos };
  }

  // ---- выражения ----
  expr() {
    let a = this.andExpr();
    while (this.eat("ИЛИ")) a = { k: "or", a, b: this.andExpr() };
    return a;
  }
  andExpr() {
    let a = this.notExpr();
    while (this.eat("И")) a = { k: "and", a, b: this.notExpr() };
    return a;
  }
  notExpr() { return this.eat("НЕ") ? { k: "not", a: this.notExpr() } : this.cmp(); }
  cmp() {
    let a = this.add();
    for (;;) {
      const pos = this.tok.pos;
      if (this.tok.t === "sym" && ["=", "<>", "<", ">", "<=", ">="].includes(this.tok.v)) { const op = this.toks[this.i++].v; a = { k: "cmp", op, a, b: this.add(), pos }; continue; }
      let neg = false;
      if (this.is("НЕ") && ["В", "МЕЖДУ", "ПОДОБНО"].includes(this.peek().u)) { this.i++; neg = true; }
      if (this.eat("В")) {
        const hier = this.eat("ИЕРАРХИИ");
        this.expect("(", "«(» после В");
        const node = { k: "in", a, neg, hier, pos };
        if (this.is("ВЫБРАТЬ")) node.sub = this.query();
        else { node.list = []; do { node.list.push(this.expr()); } while (this.eat(",")); }
        this.expect(")");
        a = node; continue;
      }
      if (this.eat("МЕЖДУ")) { const lo = this.add(); this.expect("И", "И в МЕЖДУ … И …"); a = { k: "between", a, lo, hi: this.add(), neg, pos }; continue; }
      if (this.eat("ПОДОБНО")) { a = { k: "like", a, b: this.add(), neg, pos }; if (this.eat("СПЕЦСИМВОЛ")) this.i++; continue; }
      if (this.eat("ЕСТЬ")) { const n = this.eat("НЕ"); this.expect("NULL", "NULL после ЕСТЬ"); a = { k: "isnull", a, neg: n, pos }; continue; }
      if (this.is("ССЫЛКА") && this.peek().t === "id") { this.i++; a = { k: "refs", a, type: this.dotted(), pos }; continue; }
      return a;
    }
  }
  add() {
    let a = this.mul();
    while (this.tok.t === "sym" && (this.tok.v === "+" || this.tok.v === "-")) { const pos = this.tok.pos; const op = this.toks[this.i++].v; a = { k: "bin", op, a, b: this.mul(), pos }; }
    return a;
  }
  mul() {
    let a = this.unary();
    while (this.tok.t === "sym" && (this.tok.v === "*" || this.tok.v === "/")) { const pos = this.tok.pos; const op = this.toks[this.i++].v; a = { k: "bin", op, a, b: this.unary(), pos }; }
    return a;
  }
  unary() {
    if (this.tok.t === "sym" && this.tok.v === "-") { this.i++; return { k: "neg", a: this.unary() }; }
    if (this.tok.t === "sym" && this.tok.v === "+") { this.i++; return this.unary(); }
    return this.primary();
  }
  dotted() { const p = [this.ident("имя типа")]; while (this.eat(".")) p.push(this.ident()); return p.join("."); }
  typeName() {
    const name = this.dotted(); const args = [];
    if (this.eat("(")) { do { if (this.tok.t !== "num") fail("В описании типа ожидалось число", this.tok.pos); args.push(this.toks[this.i++].v); } while (this.eat(",")); this.expect(")"); }
    return { name, args };
  }
  primary() {
    const t = this.tok; const pos = t.pos;
    if (t.t === "num") { this.i++; return { k: "lit", v: t.v }; }
    if (t.t === "str") { this.i++; return { k: "lit", v: t.v }; }
    if (t.t === "param") { this.i++; return { k: "param", name: t.v, pos }; }
    if (t.t === "sym" && t.v === "*") { this.i++; return { k: "star", alias: null, pos }; }
    if (t.t === "sym" && t.v === "(") {
      this.i++;
      if (this.is("ВЫБРАТЬ")) fail("Вложенный запрос допустим только в ИЗ и в условии В (…)", pos);
      const e = this.expr();
      if (this.is(",")) { const items = [e]; while (this.eat(",")) items.push(this.expr()); this.expect(")"); return { k: "tuple", items, pos }; }
      this.expect(")");
      return e;
    }
    if (t.t !== "id") fail(`Ожидалось выражение, а встретилось «${t.v}»`, pos);
    const call = this.peek().t === "sym" && this.peek().v === "(";
    switch (t.u) {
      case "ИСТИНА": this.i++; return { k: "lit", v: true };
      case "ЛОЖЬ": this.i++; return { k: "lit", v: false };
      case "NULL": this.i++; return { k: "lit", v: null };
      case "НЕОПРЕДЕЛЕНО": this.i++; return { k: "lit", v: undefined };
      case "ВЫБОР": {
        this.i++;
        const node = { k: "case", subject: this.is("КОГДА") ? null : this.expr(), whens: [], other: null, pos };
        while (this.eat("КОГДА")) { const c = this.expr(); this.expect("ТОГДА", "ТОГДА после условия КОГДА"); node.whens.push([c, this.expr()]); }
        if (!node.whens.length) fail("В ВЫБОР нет ни одной ветки КОГДА … ТОГДА …", pos);
        if (this.eat("ИНАЧЕ")) node.other = this.expr();
        this.expect("КОНЕЦ", "КОНЕЦ, закрывающий ВЫБОР");
        return node;
      }
    }
    if (call && t.u === "ВЫРАЗИТЬ") {
      this.i += 2; const a = this.expr(); this.expect("КАК", "КАК в ВЫРАЗИТЬ(… КАК Тип)");
      const type = this.typeName(); this.expect(")");
      const rest = []; while (this.eat(".")) rest.push(this.ident("имя поля"));
      return { k: "cast", a, type, rest, pos };
    }
    if (call && (t.u === "ЗНАЧЕНИЕ" || t.u === "ТИП")) { this.i += 2; const path = this.dotted(); this.expect(")"); return { k: t.u === "ТИП" ? "type" : "value", path, pos }; }
    if (call && AGG.has(t.u)) {
      this.i += 2; const node = { k: "agg", fn: t.u, distinct: false, star: false, a: null, pos };
      if (this.eat("РАЗЛИЧНЫЕ")) node.distinct = true;
      if (this.tok.t === "sym" && this.tok.v === "*") { this.i++; node.star = true; } else node.a = this.expr();
      if (node.star && t.u !== "КОЛИЧЕСТВО") fail(`«*» допустима только в КОЛИЧЕСТВО(*)`, pos);
      this.expect(")"); return node;
    }
    if (call) {
      this.i += 2; const args = [];
      if (!this.eat(")")) { do { args.push(this.expr()); } while (this.eat(",")); this.expect(")"); }
      const perAt = { НАЧАЛОПЕРИОДА: 1, КОНЕЦПЕРИОДА: 1, ДОБАВИТЬКДАТЕ: 1, РАЗНОСТЬДАТ: 2 }[t.u];
      if (perAt !== undefined && args[perAt]?.k === "field" && args[perAt].path.length === 1) args[perAt] = { k: "per", name: norm(args[perAt].path[0]), pos: args[perAt].pos };
      return { k: "call", name: t.u, args, pos };
    }
    if (KEYWORDS.has(t.u) && t.u !== "ССЫЛКА") fail(`Ожидалось выражение, а встретилось ключевое слово «${t.v}»`, pos);
    const path = [this.ident()];
    while (this.eat(".")) {
      if (this.tok.t === "sym" && this.tok.v === "*") { this.i++; return { k: "star", alias: path[0], pos }; }
      path.push(this.ident("имя поля после точки"));
    }
    return { k: "field", path, pos };
  }
}

export const parse = (text) => new Parser(text).batch();

const kids = (n) => {
  switch (n?.k) {
    case "or": case "and": case "cmp": case "bin": return [n.a, n.b];
    case "not": case "neg": case "isnull": case "refs": case "cast": return [n.a];
    case "in": return [n.a, ...(n.list ?? [])];
    case "between": return [n.a, n.lo, n.hi];
    case "like": return [n.a, n.b];
    case "case": return [n.subject, ...n.whens.flat(), n.other].filter(Boolean);
    case "call": return n.args;
    case "agg": return n.a ? [n.a] : [];
    case "tuple": return n.items;
    default: return [];
  }
};
const walk = (n, fn) => { if (!n) return; fn(n); for (const c of kids(n)) walk(c, fn); };
const hasAgg = (n) => { let f = false; walk(n, (x) => { if (x.k === "agg") f = true; }); return f; };

// ======================= значения =======================
const ids = new WeakMap(); let seq = 0;
const key = (v) => {
  if (v === null) return "N"; if (v === undefined) return "U";
  if (v instanceof Date) return "d" + v.getTime();
  if (typeof v === "object") { if (!ids.has(v)) ids.set(v, ++seq); return "r" + ids.get(v); }
  if (typeof v === "string") return "s" + norm(v.trimEnd());
  return typeof v + v;
};
const rank = (v) => (v === null ? 0 : v === undefined ? 1 : typeof v === "boolean" ? 2 : typeof v === "number" ? 3 : v instanceof Date ? 4 : typeof v === "string" ? 5 : 6);
/** Сравнение для сортировки и <, > */
export function compare(a, b) {
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 3 || ra === 2) return a - b;
  if (ra === 4) return a.getTime() - b.getTime();
  if (ra === 5) return a.trimEnd().localeCompare(b.trimEnd(), "ru", { sensitivity: "accent" });
  if (ra === 6) return presentation(a).localeCompare(presentation(b), "ru") || key(a).localeCompare(key(b));
  return 0;
}
const eq = (a, b) => (a === null || b === null ? null : key(a) === key(b));
const truthy = (v) => v === true;

function likeRe(p) {
  let re = "";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "%") re += "[\\s\\S]*"; else if (c === "_") re += "[\\s\\S]";
    else if (c === "[") { const j = p.indexOf("]", i); if (j < 0) { re += "\\["; continue; } re += "[" + p.slice(i + 1, j).replace(/\\/g, "\\\\") + "]"; i = j; }
    else re += c.replace(/[.*+?^${}()|\\\]]/g, "\\$&");
  }
  return new RegExp("^" + re + "$", "iu");
}

const PERIODS = ["СЕКУНДА", "МИНУТА", "ЧАС", "ДЕНЬ", "НЕДЕЛЯ", "ДЕКАДА", "МЕСЯЦ", "КВАРТАЛ", "ПОЛУГОДИЕ", "ГОД"];
function periodStart(d, per) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  switch (per) {
    case "ГОД": return new Date(Date.UTC(y, 0, 1));
    case "ПОЛУГОДИЕ": return new Date(Date.UTC(y, m < 6 ? 0 : 6, 1));
    case "КВАРТАЛ": return new Date(Date.UTC(y, m - (m % 3), 1));
    case "МЕСЯЦ": return new Date(Date.UTC(y, m, 1));
    case "ДЕКАДА": return new Date(Date.UTC(y, m, day <= 10 ? 1 : day <= 20 ? 11 : 21));
    case "НЕДЕЛЯ": return new Date(Date.UTC(y, m, day - ((d.getUTCDay() + 6) % 7)));
    case "ДЕНЬ": return new Date(Date.UTC(y, m, day));
    case "ЧАС": return new Date(Date.UTC(y, m, day, d.getUTCHours()));
    case "МИНУТА": return new Date(Date.UTC(y, m, day, d.getUTCHours(), d.getUTCMinutes()));
    default: return d;
  }
}
function addPeriod(d, per, n) {
  const r = new Date(d.getTime());
  switch (per) {
    case "СЕКУНДА": r.setUTCSeconds(r.getUTCSeconds() + n); break;
    case "МИНУТА": r.setUTCMinutes(r.getUTCMinutes() + n); break;
    case "ЧАС": r.setUTCHours(r.getUTCHours() + n); break;
    case "ДЕНЬ": r.setUTCDate(r.getUTCDate() + n); break;
    case "НЕДЕЛЯ": r.setUTCDate(r.getUTCDate() + 7 * n); break;
    case "ДЕКАДА": r.setUTCDate(r.getUTCDate() + 10 * n); break;
    case "МЕСЯЦ": case "КВАРТАЛ": case "ПОЛУГОДИЕ": case "ГОД": {
      const months = n * { МЕСЯЦ: 1, КВАРТАЛ: 3, ПОЛУГОДИЕ: 6, ГОД: 12 }[per];
      const day = r.getUTCDate(); r.setUTCDate(1); r.setUTCMonth(r.getUTCMonth() + months);
      r.setUTCDate(Math.min(day, new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate())); break;
    }
  }
  return r;
}
const periodEnd = (d, per) => new Date(addPeriod(periodStart(d, per), per, 1).getTime() - 1000);

// ======================= вычисление выражений =======================
function resolve(node, scope) {
  if (node.__r && node.__r.srcs === scope.srcs) return node.__r;
  const p = node.path; const a0 = norm(p[0]);
  let r = null;
  const bySrc = scope.srcs.findIndex((s) => s.alias === a0);
  if (p.length >= 2 && bySrc >= 0) {
    const col = scope.srcs[bySrc].cols.get(norm(p[1]));
    if (!col) fail(`Поле «${p[1]}» не найдено в таблице «${p[0]}»`, node.pos);
    r = { srcs: scope.srcs, i: bySrc, col, rest: p.slice(2) };
  } else {
    const found = scope.srcs.map((s, i) => [i, s.cols.get(a0)]).filter(([, c]) => c);
    if (found.length > 1) fail(`Неоднозначное поле «${p[0]}»: есть в нескольких таблицах, укажи псевдоним таблицы`, node.pos);
    if (found.length === 1) r = { srcs: scope.srcs, i: found[0][0], col: found[0][1], rest: p.slice(1) };
  }
  if (!r) {
    if (scope.outer) { if (scope.mark) scope.mark.corr = true; return { outer: resolve(node, scope.outer) }; }
    fail(bySrc >= 0 ? `«${p[0]}» — это таблица, укажи поле через точку` : `Поле «${p.join(".")}» не найдено`, node.pos);
  }
  node.__r = r;
  return r;
}
function deref(v, rest, pos) {
  for (const name of rest) {
    if (v === null || v === undefined || v.__empty) return null;
    if (typeof v !== "object" || !v.__t) fail(`Нельзя обратиться через точку к полю «${name}»: значение не является ссылкой`, pos);
    const col = v.__t.col.get(norm(name));
    if (!col) fail(`У объекта «${v.__t.name}» нет поля «${name}»`, pos);
    v = v[col];
  }
  return v;
}
function fieldValue(node, scope) {
  const r = resolve(node, scope);
  if (r.outer) return fieldValue(node, scope.outer);
  const row = scope.row[r.i];
  return row == null ? null : deref(row[r.col], r.rest, node.pos);
}
const num = (v, pos, what) => { if (typeof v !== "number") fail(`${what}: ожидалось число, получено «${presentation(v)}»`, pos); return v; };
const dateArg = (v, pos, fn) => { if (!(v instanceof Date)) fail(`${fn}: ожидалась дата, получено «${presentation(v)}»`, pos); return v; };
const perArg = (n, fn) => { const u = n?.k === "per" ? n.name : null; if (!PERIODS.includes(u)) fail(`${fn}: вторым параметром нужен вид периода (ДЕНЬ, МЕСЯЦ, ГОД…)`, n?.pos); return u; };

const FUNCS = {
  ЕСТЬNULL: (a, c) => { const v = ev(a[0], c); return v === null ? ev(a[1], c) : v; },
  ГОД: (a, c, p) => dateF(a, c, p, "ГОД", (d) => d.getUTCFullYear()),
  КВАРТАЛ: (a, c, p) => dateF(a, c, p, "КВАРТАЛ", (d) => Math.floor(d.getUTCMonth() / 3) + 1),
  МЕСЯЦ: (a, c, p) => dateF(a, c, p, "МЕСЯЦ", (d) => d.getUTCMonth() + 1),
  ДЕНЬ: (a, c, p) => dateF(a, c, p, "ДЕНЬ", (d) => d.getUTCDate()),
  ДЕНЬНЕДЕЛИ: (a, c, p) => dateF(a, c, p, "ДЕНЬНЕДЕЛИ", (d) => ((d.getUTCDay() + 6) % 7) + 1),
  ДЕНЬГОДА: (a, c, p) => dateF(a, c, p, "ДЕНЬГОДА", (d) => Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1),
  ЧАС: (a, c, p) => dateF(a, c, p, "ЧАС", (d) => d.getUTCHours()),
  МИНУТА: (a, c, p) => dateF(a, c, p, "МИНУТА", (d) => d.getUTCMinutes()),
  НАЧАЛОПЕРИОДА: (a, c, p) => { const v = ev(a[0], c); return v === null ? null : periodStart(dateArg(v, p, "НАЧАЛОПЕРИОДА"), perArg(a[1], "НАЧАЛОПЕРИОДА")); },
  КОНЕЦПЕРИОДА: (a, c, p) => { const v = ev(a[0], c); return v === null ? null : periodEnd(dateArg(v, p, "КОНЕЦПЕРИОДА"), perArg(a[1], "КОНЕЦПЕРИОДА")); },
  ДОБАВИТЬКДАТЕ: (a, c, p) => { const v = ev(a[0], c); return v === null ? null : addPeriod(dateArg(v, p, "ДОБАВИТЬКДАТЕ"), perArg(a[1], "ДОБАВИТЬКДАТЕ"), num(ev(a[2], c), p, "ДОБАВИТЬКДАТЕ")); },
  РАЗНОСТЬДАТ: (a, c, p) => {
    const x = ev(a[0], c), y = ev(a[1], c); if (x === null || y === null) return null;
    dateArg(x, p, "РАЗНОСТЬДАТ"); dateArg(y, p, "РАЗНОСТЬДАТ");
    const per = perArg(a[2], "РАЗНОСТЬДАТ");
    const months = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth();
    if (per === "ГОД") return y.getUTCFullYear() - x.getUTCFullYear();
    if (per === "КВАРТАЛ") return Math.floor(y.getUTCMonth() / 3) - Math.floor(x.getUTCMonth() / 3) + 4 * (y.getUTCFullYear() - x.getUTCFullYear());
    if (per === "МЕСЯЦ") return months;
    const unit = { СЕКУНДА: 1e3, МИНУТА: 6e4, ЧАС: 36e5, ДЕНЬ: 864e5, НЕДЕЛЯ: 6048e5, ДЕКАДА: 864e6 }[per];
    return Math.round((periodStart(y, per === "НЕДЕЛЯ" || per === "ДЕКАДА" ? "ДЕНЬ" : per) - periodStart(x, per === "НЕДЕЛЯ" || per === "ДЕКАДА" ? "ДЕНЬ" : per)) / unit);
  },
  ДАТАВРЕМЯ: (a, c, p) => { const v = a.map((x) => num(ev(x, c), p, "ДАТАВРЕМЯ")); if (v.length < 3) fail("ДАТАВРЕМЯ(Год, Месяц, День[, Час, Минута, Секунда])", p); return D(...v); },
  ПОДСТРОКА: (a, c, p) => { const s = ev(a[0], c); if (s === null) return null; if (typeof s !== "string") fail("ПОДСТРОКА: первый параметр — строка", p); const from = num(ev(a[1], c), p, "ПОДСТРОКА"); return s.substr(from - 1, num(ev(a[2], c), p, "ПОДСТРОКА")); },
  ДЛИНАСТРОКИ: (a, c) => { const s = ev(a[0], c); return s === null ? null : String(s).length; },
  ВРЕГ: (a, c) => { const s = ev(a[0], c); return s === null ? null : String(s).toUpperCase(); },
  НРЕГ: (a, c) => { const s = ev(a[0], c); return s === null ? null : String(s).toLowerCase(); },
  СОКРЛП: (a, c) => { const s = ev(a[0], c); return s === null ? null : String(s).trim(); },
  ПРЕДСТАВЛЕНИЕ: (a, c) => presentation(ev(a[0], c)),
  ПРЕДСТАВЛЕНИЕССЫЛКИ: (a, c) => presentation(ev(a[0], c)),
  ТИПЗНАЧЕНИЯ: (a, c) => { const v = ev(a[0], c); return v === null ? null : typeOf(v) ?? (v instanceof Date ? "Дата" : { number: "Число", string: "Строка", boolean: "Булево" }[typeof v] ?? "Неопределено"); },
  ОКР: (a, c, p) => { const v = ev(a[0], c); if (v === null) return null; const k = 10 ** (a[1] ? num(ev(a[1], c), p, "ОКР") : 0); return Math.round(num(v, p, "ОКР") * k) / k; },
  ЦЕЛ: (a, c, p) => { const v = ev(a[0], c); return v === null ? null : Math.trunc(num(v, p, "ЦЕЛ")); },
};
function dateF(a, c, p, name, f) { const v = ev(a[0], c); return v === null ? null : f(dateArg(v, p, name)); }

function ev(n, c) {
  switch (n.k) {
    case "lit": return n.v;
    case "field": return fieldValue(n, c);
    case "param": {
      const u = norm(n.name);
      if (!c.ctx.params.has(u)) fail(`Не задан параметр &${n.name}`, n.pos);
      return c.ctx.params.get(u);
    }
    case "neg": { const v = ev(n.a, c); return v === null ? null : -num(v, n.pos, "Унарный минус"); }
    case "bin": {
      const a = ev(n.a, c), b = ev(n.b, c);
      if (a === null || b === null) return null;
      if (n.op === "+" && typeof a === "string" && typeof b === "string") return a + b;
      if (typeof a !== "number" || typeof b !== "number") fail(`Операция «${n.op}» применима к числам (и «+» к строкам), а получено «${presentation(a)}» и «${presentation(b)}»`, n.pos);
      if (n.op === "/" && b === 0) fail("Деление на ноль", n.pos);
      const r = n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : a / b;
      return Math.round(r * 1e8) / 1e8;
    }
    case "cmp": {
      const a = ev(n.a, c), b = ev(n.b, c);
      if (a === null || b === null) return null;
      if (n.op === "=") return eq(a, b);
      if (n.op === "<>") return !eq(a, b);
      if (rank(a) !== rank(b)) fail(`Несовместимые типы в сравнении «${n.op}»: «${presentation(a)}» и «${presentation(b)}»`, n.pos);
      const x = compare(a, b);
      return n.op === "<" ? x < 0 : n.op === ">" ? x > 0 : n.op === "<=" ? x <= 0 : x >= 0;
    }
    case "and": { const a = ev(n.a, c); if (a === false) return false; const b = ev(n.b, c); return b === false ? false : a === null || b === null ? null : truthy(a) && truthy(b); }
    case "or": { const a = ev(n.a, c); if (a === true) return true; const b = ev(n.b, c); return b === true ? true : a === null || b === null ? null : false; }
    case "not": { const a = ev(n.a, c); return a === null ? null : !truthy(a); }
    case "isnull": return (ev(n.a, c) === null) !== n.neg;
    case "between": {
      const v = ev(n.a, c), lo = ev(n.lo, c), hi = ev(n.hi, c);
      if (v === null || lo === null || hi === null) return null;
      return (compare(v, lo) >= 0 && compare(v, hi) <= 0) !== n.neg;
    }
    case "like": { const v = ev(n.a, c), p = ev(n.b, c); if (v === null || p === null) return null; return likeRe(String(p)).test(String(v)) !== n.neg; }
    case "refs": { const v = ev(n.a, c); return v !== null && norm(typeOf(v) ?? "") === norm(n.type); }
    case "in": {
      const tuple = n.a.k === "tuple";
      const v = tuple ? n.a.items.map((x) => ev(x, c)) : ev(n.a, c);
      let set;
      if (n.sub) {
        if (!n.__cache || n.__cache.ctx !== c.ctx || n.__cache.corr) {
          const mark = { corr: false };
          const res = runQuery(n.sub, c.ctx, c, mark);
          if (res.columns.length !== (tuple ? v.length : 1)) fail(`Вложенный запрос в В (…) должен возвращать ${tuple ? v.length : "одну"} колон${tuple ? "ок" : "ку"}, а возвращает ${res.columns.length}`, n.pos);
          n.__cache = { ctx: c.ctx, corr: mark.corr, set: new Set(res.rows.map((r) => r.map(key).join("|"))), vals: res.rows.map((r) => r[0]) };
        }
        set = n.__cache;
      } else {
        const vals = n.list.flatMap((x) => { const y = ev(x, c); return Array.isArray(y) ? y : [y]; });
        set = { set: new Set(vals.map(key)), vals };
      }
      if (n.hier) {
        for (let x = v, guard = 0; x && typeof x === "object" && guard < 50; x = x.Родитель, guard++) if (set.set.has(key(x))) return !n.neg;
        return n.neg;
      }
      if (!tuple && v === null) return null;
      return set.set.has(tuple ? v.map(key).join("|") : key(v)) !== n.neg;
    }
    case "case": {
      const s = n.subject ? ev(n.subject, c) : undefined;
      for (const [w, t] of n.whens) if (n.subject ? eq(s, ev(w, c)) === true : truthy(ev(w, c))) return ev(t, c);
      return n.other ? ev(n.other, c) : null;
    }
    case "cast": {
      let v = ev(n.a, c);
      const t = norm(n.type.name);
      if (v === null) return null;
      if (t === "ЧИСЛО") { num(v, n.pos, "ВЫРАЗИТЬ КАК Число"); const k = 10 ** (n.type.args[1] ?? 0); v = Math.round(v * k) / k; }
      else if (t === "СТРОКА") { if (typeof v !== "string") fail("ВЫРАЗИТЬ КАК Строка применимо только к строкам", n.pos); if (n.type.args[0]) v = v.slice(0, n.type.args[0]); }
      else if (t === "ДАТА") dateArg(v, n.pos, "ВЫРАЗИТЬ КАК Дата");
      else if (t === "БУЛЕВО") { if (typeof v !== "boolean") v = null; }
      else { if (!getTable(n.type.name)) fail(`Тип «${n.type.name}» не найден`, n.pos); if (norm(typeOf(v) ?? "") !== t) v = null; }
      return deref(v, n.rest, n.pos);
    }
    case "value": { const v = predefined(n.path); if (v === undefined) fail(`ЗНАЧЕНИЕ(${n.path}): такого предопределённого значения нет`, n.pos); return v; }
    case "type": return n.path;
    case "call": { const f = FUNCS[n.name]; if (!f) fail(`Неизвестная функция «${n.name}»`, n.pos); return f(n.args, c, n.pos); }
    case "agg": {
      if (!c.group) fail(`Агрегатная функция ${n.fn} здесь недопустима (например, в ГДЕ — используй ИМЕЮЩИЕ)`, n.pos);
      if (c.inAgg) fail("Вложенные агрегатные функции не допускаются", n.pos);
      if (n.star) return c.group.length;
      let vals = c.group.map((row) => ev(n.a, { ...c, row, group: null, inAgg: true })).filter((v) => v !== null);
      if (n.distinct) { const seen = new Set(); vals = vals.filter((v) => !seen.has(key(v)) && seen.add(key(v))); }
      if (n.fn === "КОЛИЧЕСТВО") return vals.length;
      if (!vals.length) return null;
      if (n.fn === "МАКСИМУМ") return vals.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
      if (n.fn === "МИНИМУМ") return vals.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
      vals.forEach((v) => num(v, n.pos, n.fn));
      const sum = Math.round(vals.reduce((a, b) => a + b, 0) * 1e8) / 1e8;
      return n.fn === "СУММА" ? sum : Math.round((sum / vals.length) * 1e8) / 1e8;
    }
    case "star": fail("«*» допустима только в списке полей и в КОЛИЧЕСТВО(*)", n.pos); break;
    case "tuple": fail("Список в скобках допустим только слева от В (…)", n.pos); break;
    default: fail("Неподдерживаемое выражение", n.pos);
  }
}

// ======================= виртуальные таблицы =======================
const mkSource = (alias, colNames, rows) => ({ alias: norm(alias), name: alias, cols: new Map(colNames.map((c) => [norm(c), c])), colNames, rows });

function aggregate(rows, dims, measures, keepZero = false) {
  const groups = new Map();
  for (const r of rows) {
    const k = dims.map((d) => key(r[d])).join("|");
    let g = groups.get(k);
    if (!g) { g = {}; for (const d of dims) g[d] = r[d]; for (const m in measures) g[m] = 0; groups.set(k, g); }
    for (const m in measures) g[m] = Math.round((g[m] + measures[m](r)) * 1e6) / 1e6;
  }
  const out = [...groups.values()];
  return keepZero ? out : out.filter((g) => Object.keys(measures).some((m) => g[m] !== 0));
}
const bucketOf = (d, per) => (per === "РЕГИСТРАТОР" || per === "ПЕРИОД" || per === "ЗАПИСЬ" ? d : periodStart(d, per === "АВТО" ? "ДЕНЬ" : per));

function virtualTable(t, vname, params, alias, used, ctx, pos) {
  const P = params ?? [];
  const constScope = { srcs: [], row: [], ctx };
  const val = (i) => (P[i] ? ev(P[i], constScope) : null);
  const dateP = (i, what) => { const v = val(i); if (v !== null && !(v instanceof Date)) fail(`${vname}: параметр «${what}» должен быть датой`, P[i].pos ?? pos); return v; };
  const perP = (i) => { const n = P[i]; if (!n) return null; const u = n.k === "field" && n.path.length === 1 ? norm(n.path[0]) : null; if (!["ПЕРИОД", "ЗАПИСЬ", "РЕГИСТРАТОР", "АВТО", ...PERIODS].includes(u)) fail(`${vname}: неизвестная периодичность`, n.pos ?? pos); return u; };
  const cond = (rows, i, colNames) => {
    if (!P[i]) return rows;
    const src = mkSource(alias, colNames, rows);
    return rows.filter((r) => truthy(ev(P[i], { srcs: [src], row: [r], ctx })));
  };
  const maxParams = (n) => { if (P.length > n) fail(`У виртуальной таблицы ${vname} не больше ${n} параметров, передано ${P.length}`, pos); };
  const names = (role) => t.fields.filter((f) => f.role === role).map((f) => f.n);
  const dims = names("dim"), ress = names("res");
  const usedDims = (list) => list.filter((d) => used(norm(d)));
  const V = norm(vname);
  const phys = t.fields.map((f) => f.n);

  if (t.reg === "info") {
    if (!t.periodic || !["СРЕЗПОСЛЕДНИХ", "СРЕЗПЕРВЫХ"].includes(V)) fail(`У регистра сведений «${t.name}» нет виртуальной таблицы «${vname}»`, pos);
    maxParams(2);
    const last = V === "СРЕЗПОСЛЕДНИХ"; const date = dateP(0, "Период");
    let rows = t.rows.filter((r) => date === null || (last ? r.Период <= date : r.Период >= date));
    rows = cond(rows, 1, phys);
    const best = new Map();
    for (const r of rows) { const k = dims.map((d) => key(r[d])).join("|"); const b = best.get(k); if (!b || (last ? r.Период >= b.Период : r.Период < b.Период)) best.set(k, r); }
    return mkSource(alias, phys, [...best.values()]);
  }

  if (t.reg === "accum") {
    const sign = (r) => (t.sub === "balance" && r.ВидДвижения?.__name === "Расход" ? -1 : 1);
    if (V === "ОСТАТКИ") {
      if (t.sub !== "balance") fail(`«${t.name}» — оборотный регистр, у него нет таблицы Остатки`, pos);
      maxParams(2);
      const date = dateP(0, "Период");
      const rows = cond(t.rows.filter((r) => date === null || r.Период < date), 1, phys);
      const ud = usedDims(dims); const m = {};
      for (const r of ress) m[r + "Остаток"] = (x) => sign(x) * x[r];
      return mkSource(alias, [...dims, ...Object.keys(m)], aggregate(rows, ud, m));
    }
    if (V === "ОБОРОТЫ") {
      maxParams(4);
      const from = dateP(0, "НачалоПериода"), to = dateP(1, "КонецПериода"), per = perP(2);
      let rows = cond(t.rows.filter((r) => (from === null || r.Период >= from) && (to === null || r.Период <= to)), 3, phys);
      const extra = per ? (per === "РЕГИСТРАТОР" ? ["Период", "Регистратор"] : ["Период"]) : [];
      if (per) rows = rows.map((r) => ({ ...r, Период: bucketOf(r.Период, per) }));
      const m = {};
      for (const r of ress) {
        m[r + "Оборот"] = (x) => sign(x) * x[r];
        if (t.sub === "balance") { m[r + "Приход"] = (x) => (sign(x) > 0 ? x[r] : 0); m[r + "Расход"] = (x) => (sign(x) < 0 ? x[r] : 0); }
      }
      return mkSource(alias, [...extra, ...dims, ...Object.keys(m)], aggregate(rows, [...usedDims(extra), ...usedDims(dims)], m, true));
    }
    if (V === "ОСТАТКИИОБОРОТЫ") {
      if (t.sub !== "balance") fail(`«${t.name}» — оборотный регистр, у него нет таблицы ОстаткиИОбороты`, pos);
      maxParams(5);
      const from = dateP(0, "НачалоПериода"), to = dateP(1, "КонецПериода"), per = perP(2);
      const all = cond(t.rows.filter((r) => to === null || r.Период <= to), 4, phys);
      const ud = usedDims(dims); const out = [];
      const groups = new Map();
      for (const r of all) { const k = ud.map((d) => key(r[d])).join("|"); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
      for (const g of groups.values()) {
        const before = g.filter((r) => from !== null && r.Период < from), inside = g.filter((r) => from === null || r.Период >= from).sort((a, b) => a.Период - b.Период);
        const bal = {}; for (const r of ress) bal[r] = before.reduce((s, x) => s + sign(x) * x[r], 0);
        const buckets = new Map();
        for (const r of inside) { const b = per ? bucketOf(r.Период, per) : null; const k = b ? b.getTime() + (per === "РЕГИСТРАТОР" ? key(r.Регистратор) : "") : "all"; if (!buckets.has(k)) buckets.set(k, { b, reg: r.Регистратор, rows: [] }); buckets.get(k).rows.push(r); }
        if (!buckets.size) buckets.set("all", { b: null, rows: [] });
        for (const { b, reg, rows } of buckets.values()) {
          const row = {}; for (const d of ud) row[d] = g[0][d];
          if (per) { row.Период = b; if (per === "РЕГИСТРАТОР") row.Регистратор = reg; }
          let nonZero = false;
          for (const r of ress) {
            const inc = rows.reduce((s, x) => s + (sign(x) > 0 ? x[r] : 0), 0), dec = rows.reduce((s, x) => s + (sign(x) < 0 ? x[r] : 0), 0);
            row[r + "НачальныйОстаток"] = bal[r]; row[r + "Приход"] = inc; row[r + "Расход"] = dec; row[r + "Оборот"] = inc - dec;
            bal[r] = row[r + "КонечныйОстаток"] = bal[r] + inc - dec;
            if (inc || dec || row[r + "НачальныйОстаток"]) nonZero = true;
          }
          if (nonZero) out.push(row);
        }
      }
      const extra = per ? (per === "РЕГИСТРАТОР" ? ["Период", "Регистратор"] : ["Период"]) : [];
      return mkSource(alias, [...extra, ...dims, ...ress.flatMap((r) => ["НачальныйОстаток", "Приход", "Расход", "Оборот", "КонечныйОстаток"].map((s) => r + s))], out);
    }
    fail(`У регистра накопления «${t.name}» нет виртуальной таблицы «${vname}»`, pos);
  }

  if (t.reg === "acc") {
    const entries = (rows) => rows.flatMap((p) => [
      { Период: p.Период, Регистратор: p.Регистратор, Счет: p.СчетДт, Субконто1: p.СубконтоДт1, Субконто2: p.СубконтоДт2, КорСчет: p.СчетКт, КорСубконто1: p.СубконтоКт1, КорСубконто2: p.СубконтоКт2, дт: p.Сумма, кт: 0, кдт: p.КоличествоДт, ккт: 0 },
      { Период: p.Период, Регистратор: p.Регистратор, Счет: p.СчетКт, Субконто1: p.СубконтоКт1, Субконто2: p.СубконтоКт2, КорСчет: p.СчетДт, КорСубконто1: p.СубконтоДт1, КорСубконто2: p.СубконтоДт2, дт: 0, кт: p.Сумма, кдт: 0, ккт: p.КоличествоКт },
    ]);
    const eCols = ["Период", "Регистратор", "Счет", "Субконто1", "Субконто2", "КорСчет", "КорСубконто1", "КорСубконто2"];
    const split = (rows, prefix, name) => { for (const r of rows) for (const res of ["Сумма", "Количество"]) { const v = r[res + prefix + name]; r[res + prefix + name + "Дт"] = v > 0 ? v : 0; r[res + prefix + name + "Кт"] = v < 0 ? -v : 0; } };
    if (V === "ОСТАТКИ") {
      maxParams(4);
      const date = dateP(0, "Период");
      let rows = entries(t.rows.filter((r) => date === null || r.Период < date));
      rows = cond(cond(rows, 1, eCols), 3, eCols);
      const d = ["Счет", "Субконто1", "Субконто2"];
      const out = aggregate(rows, usedDims(d), { СуммаОстаток: (x) => x.дт - x.кт, КоличествоОстаток: (x) => x.кдт - x.ккт });
      split(out, "", "Остаток");
      for (const r of out) for (const res of ["Сумма", "Количество"]) { r[res + "РазвернутыйОстатокДт"] = r[res + "ОстатокДт"]; r[res + "РазвернутыйОстатокКт"] = r[res + "ОстатокКт"]; }
      return mkSource(alias, [...d, ...["Сумма", "Количество"].flatMap((r) => ["Остаток", "ОстатокДт", "ОстатокКт", "РазвернутыйОстатокДт", "РазвернутыйОстатокКт"].map((s) => r + s))], out);
    }
    if (V === "ОБОРОТЫ") {
      maxParams(8);
      const from = dateP(0, "НачалоПериода"), to = dateP(1, "КонецПериода"), per = perP(2);
      let rows = entries(t.rows.filter((r) => (from === null || r.Период >= from) && (to === null || r.Период <= to)));
      rows = cond(cond(cond(rows, 3, eCols), 5, eCols), 6, eCols);
      if (per) rows = rows.map((r) => ({ ...r, Период: bucketOf(r.Период, per) }));
      const extra = per ? (per === "РЕГИСТРАТОР" ? ["Период", "Регистратор"] : ["Период"]) : [];
      const d = ["Счет", "Субконто1", "Субконто2", "КорСчет", "КорСубконто1", "КорСубконто2"];
      const out = aggregate(rows, [...usedDims(extra), ...usedDims(d)], { СуммаОборот: (x) => x.дт - x.кт, СуммаОборотДт: (x) => x.дт, СуммаОборотКт: (x) => x.кт, КоличествоОборот: (x) => x.кдт - x.ккт, КоличествоОборотДт: (x) => x.кдт, КоличествоОборотКт: (x) => x.ккт }, true)
        .filter((r) => r.СуммаОборотДт || r.СуммаОборотКт);
      return mkSource(alias, [...extra, ...d, "СуммаОборот", "СуммаОборотДт", "СуммаОборотКт", "КоличествоОборот", "КоличествоОборотДт", "КоличествоОборотКт"], out);
    }
    if (V === "ОСТАТКИИОБОРОТЫ") {
      maxParams(7);
      const from = dateP(0, "НачалоПериода"), to = dateP(1, "КонецПериода");
      let rows = entries(t.rows.filter((r) => to === null || r.Период <= to));
      rows = cond(cond(rows, 4, eCols), 6, eCols);
      const isBefore = (x) => from !== null && x.Период < from;
      const d = ["Счет", "Субконто1", "Субконто2"];
      const out = aggregate(rows, usedDims(d), {
        СуммаНачальныйОстаток: (x) => (isBefore(x) ? x.дт - x.кт : 0), СуммаОборотДт: (x) => (isBefore(x) ? 0 : x.дт), СуммаОборотКт: (x) => (isBefore(x) ? 0 : x.кт), СуммаОборот: (x) => (isBefore(x) ? 0 : x.дт - x.кт), СуммаКонечныйОстаток: (x) => x.дт - x.кт,
        КоличествоНачальныйОстаток: (x) => (isBefore(x) ? x.кдт - x.ккт : 0), КоличествоОборотДт: (x) => (isBefore(x) ? 0 : x.кдт), КоличествоОборотКт: (x) => (isBefore(x) ? 0 : x.ккт), КоличествоОборот: (x) => (isBefore(x) ? 0 : x.кдт - x.ккт), КоличествоКонечныйОстаток: (x) => x.кдт - x.ккт,
      }, true).filter((r) => r.СуммаНачальныйОстаток || r.СуммаОборотДт || r.СуммаОборотКт);
      split(out, "", "НачальныйОстаток"); split(out, "", "КонечныйОстаток");
      return mkSource(alias, [...d, ...["Сумма", "Количество"].flatMap((r) => ["НачальныйОстаток", "НачальныйОстатокДт", "НачальныйОстатокКт", "ОборотДт", "ОборотКт", "Оборот", "КонечныйОстаток", "КонечныйОстатокДт", "КонечныйОстатокКт"].map((s) => r + s))], out);
    }
    if (V === "ОБОРОТЫДТКТ") {
      maxParams(8);
      const from = dateP(0, "НачалоПериода"), to = dateP(1, "КонецПериода"), per = perP(2);
      let rows = t.rows.filter((r) => (from === null || r.Период >= from) && (to === null || r.Период <= to));
      rows = cond(cond(cond(rows, 3, phys), 5, phys), 7, phys);
      if (per) rows = rows.map((r) => ({ ...r, Период: bucketOf(r.Период, per) }));
      const extra = per ? (per === "РЕГИСТРАТОР" ? ["Период", "Регистратор"] : ["Период"]) : [];
      const d = ["СчетДт", "СубконтоДт1", "СубконтоДт2", "СчетКт", "СубконтоКт1", "СубконтоКт2"];
      const out = aggregate(rows, [...usedDims(extra), ...usedDims(d)], { СуммаОборот: (x) => x.Сумма, КоличествоОборотДт: (x) => x.КоличествоДт, КоличествоОборотКт: (x) => x.КоличествоКт }, true);
      return mkSource(alias, [...extra, ...d, "СуммаОборот", "КоличествоОборотДт", "КоличествоОборотКт"], out);
    }
    fail(`У регистра бухгалтерии нет виртуальной таблицы «${vname}» (в тренажёре: Остатки, Обороты, ОстаткиИОбороты, ОборотыДтКт)`, pos);
  }

  if (t.reg === "calc") {
    if (V !== "ФАКТИЧЕСКИЙПЕРИОДДЕЙСТВИЯ") fail(`У регистра расчёта в тренажёре есть только виртуальная таблица ФактическийПериодДействия`, pos);
    maxParams(1);
    return mkSource(alias, phys, cond(t.rows.filter((r) => !r.Сторно), 0, phys));
  }
  fail(`У таблицы «${t.name}» нет виртуальных таблиц`, pos);
}

// ======================= выполнение =======================
function usedColumns(select, query) {
  const exprs = [...select.fields.map((f) => f.e), select.where, ...(select.group ?? []), select.having, ...(query?.order ?? []).map((o) => o.e)];
  const on = (n) => { if (n.k === "join") { exprs.push(n.on); on(n.left); on(n.right); } };
  select.from.forEach(on);
  const byAlias = new Map(); const free = new Set(); let all = false;
  for (const e of exprs) walk(e, (n) => {
    if (n.k === "star") { if (n.alias) byAlias.set(norm(n.alias), true); else all = true; }
    if (n.k !== "field") return;
    const a = norm(n.path[0]);
    free.add(a);
    if (n.path.length > 1) { if (!byAlias.has(a)) byAlias.set(a, new Set()); const s = byAlias.get(a); if (s !== true) s.add(norm(n.path[1])); }
  });
  return (alias) => (col) => all || free.has(col) || byAlias.get(alias) === true || byAlias.get(alias)?.has(col) || false;
}

function openTable(node, ctx, used, outer) {
  if (node.sub) {
    const res = runQuery(node.sub, ctx, outer);
    return mkSource(node.alias, res.columns, res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]]))));
  }
  const full = node.path.join(".");
  if (node.path.length === 1) {
    const tmp = ctx.temp.get(norm(full));
    if (tmp) { if (node.params) fail("У временной таблицы нет параметров", node.pos); return mkSource(node.alias ?? full, tmp.columns, tmp.rows); }
    if (!getTable(full)) fail(`Таблица «${full}» не найдена. Временная таблица с таким именем не создана (ПОМЕСТИТЬ) или уже уничтожена`, node.pos);
  }
  let t = getTable(full);
  if (t) {
    if (node.params) fail(`«${full}» — обычная таблица, параметры в скобках есть только у виртуальных (Остатки, Обороты, СрезПоследних…)`, node.pos);
    return mkSource(node.alias ?? node.path[node.path.length - 1], t.fields.map((f) => f.n), t.rows);
  }
  const vname = node.path[node.path.length - 1];
  t = getTable(node.path.slice(0, -1).join("."));
  if (!t || !t.reg) fail(`Таблица «${full}» не найдена в конфигурации`, node.pos);
  const alias = node.alias ?? node.path[node.path.length - 2] + vname;
  return virtualTable(t, vname, node.params, alias, used(norm(alias)), ctx, node.pos);
}

function runSelect(s, ctx, outer, mark, query) {
  const srcs = []; const used = usedColumns(s, query);
  const scopeFor = (row) => ({ srcs, row, ctx, outer, mark });
  const build = (node) => {
    if (node.k === "table") {
      const src = openTable(node, ctx, used, outer);
      if (srcs.some((x) => x.alias === src.alias)) fail(`Псевдоним таблицы «${src.name}» используется дважды — задай разные через КАК`, node.pos);
      const i = srcs.push(src) - 1;
      return { idx: [i], rows: src.rows.map((r) => { const a = []; a[i] = r; return a; }) };
    }
    const L = build(node.left), R = build(node.right);
    const out = []; const matchedR = new Set();
    for (const l of L.rows) {
      let hit = false;
      for (let j = 0; j < R.rows.length; j++) {
        const row = l.slice(); for (const i of R.idx) row[i] = R.rows[j][i];
        if (truthy(ev(node.on, scopeFor(row)))) { out.push(row); hit = true; matchedR.add(j); }
      }
      if (!hit && (node.type === "left" || node.type === "full")) out.push(l.slice());
    }
    if (node.type === "right" || node.type === "full") R.rows.forEach((r, j) => { if (!matchedR.has(j)) out.push(r.slice()); });
    return { idx: [...L.idx, ...R.idx], rows: out };
  };
  let rows = [[]];
  for (const node of s.from) {
    const part = build(node);
    const next = [];
    for (const a of rows) for (const b of part.rows) { const r = a.slice(); for (const i of part.idx) r[i] = b[i]; next.push(r); }
    rows = next;
    if (rows.length > 200000) fail("Слишком большое декартово произведение таблиц — добавь условие соединения", node.pos);
  }
  if (s.where) {
    if (hasAgg(s.where)) fail("В ГДЕ нельзя использовать агрегатные функции — условие на итог группы пишут в ИМЕЮЩИЕ", s.where.pos);
    rows = rows.filter((row) => truthy(ev(s.where, scopeFor(row))));
  }

  // развернуть «*»
  const fields = [];
  for (const f of s.fields) {
    if (f.e.k !== "star") { fields.push(f); continue; }
    const list = f.e.alias ? srcs.filter((x) => x.alias === norm(f.e.alias)) : srcs;
    if (!list.length) fail(f.e.alias ? `Таблица «${f.e.alias}» не найдена` : "«*» без раздела ИЗ", f.pos);
    for (const src of list) for (const c of src.colNames) fields.push({ e: { k: "field", path: [src.name, c], pos: f.pos }, alias: null, auto: c, pos: f.pos });
  }
  // имена колонок
  const columns = []; const seen = new Map();
  fields.forEach((f, i) => {
    let name = f.alias ?? f.auto ?? (f.e.k === "field" ? f.e.path[f.e.path.length - 1] : f.e.k === "cast" && f.e.rest.length ? f.e.rest[f.e.rest.length - 1] : `Поле${i + 1}`);
    const u = norm(name);
    if (seen.has(u)) {
      if (f.alias) fail(`Псевдоним «${name}» повторяется — имена колонок результата должны быть уникальны`, f.pos);
      let k = 1; while (seen.has(u + k)) k++; name += k;
    }
    seen.set(norm(name), true); columns.push(name);
  });

  const grouped = !!s.group || !!s.having || fields.some((f) => hasAgg(f.e));
  let out; // [{vals, row, group}]
  if (grouped) {
    const groupExprs = s.group ?? [];
    const base = { srcs, row: [], ctx, outer, mark };
    const ser = (n) => (n.k === "field" ? (() => { const r = resolve(n, base); return r.outer ? "o:" + n.path.join(".") : `#${r.i}.${r.col}.${r.rest.join(".")}`; })() : `${n.k}:${n.op ?? n.name ?? n.fn ?? (n.k === "lit" ? JSON.stringify(n.v ?? null) : "")}:${n.path ?? ""}(${kids(n).map(ser).join(",")})`);
    const gset = new Set(groupExprs.map((g) => { if (hasAgg(g)) fail("В СГРУППИРОВАТЬ ПО нельзя использовать агрегатные функции", g.pos); return ser(g); }));
    const check = (n) => {
      if (!n || n.k === "agg" || gset.has(ser(n))) return;
      if (n.k === "field") fail(`Поле «${n.path.join(".")}» не входит в СГРУППИРОВАТЬ ПО и не обёрнуто в агрегатную функцию`, n.pos);
      kids(n).forEach(check);
    };
    fields.forEach((f) => check(f.e)); check(s.having);
    const groups = new Map();
    for (const row of rows) { const k = groupExprs.map((g) => key(ev(g, scopeFor(row)))).join("|"); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(row); }
    if (!groupExprs.length && !groups.size) groups.set("", []);
    out = [];
    for (const g of groups.values()) {
      const c = { ...scopeFor(g[0] ?? []), group: g };
      if (s.having && !truthy(ev(s.having, c))) continue;
      out.push({ vals: fields.map((f) => ev(f.e, c)), row: g[0] ?? [], group: g });
    }
  } else {
    out = rows.map((row) => ({ vals: fields.map((f) => ev(f.e, scopeFor(row))), row, group: null }));
  }
  if (s.distinct) { const seenRows = new Set(); out = out.filter((o) => { const k = o.vals.map(key).join("|"); return !seenRows.has(k) && seenRows.add(k); }); }
  return { columns, out, srcs };
}

function runQuery(q, ctx, outer, mark) {
  const first = runSelect(q.selects[0], ctx, outer, mark, q.selects.length === 1 ? q : null);
  let { columns, out } = first;
  const single = q.selects.length === 1;
  if (!single && q.selects[0].top !== null) out = out.slice(0, q.selects[0].top);
  q.selects.slice(1).forEach((s, i) => {
    if (s.into) fail("ПОМЕСТИТЬ указывается только в первом запросе объединения", s.pos);
    const part = runSelect(s, ctx, outer, mark, null);
    if (part.columns.length !== columns.length) fail(`В объединяемых запросах разное число полей: ${columns.length} и ${part.columns.length}`, s.pos);
    let rows = s.top !== null ? part.out.slice(0, s.top) : part.out;
    out = out.concat(rows);
    if (!q.all[i]) { const seen = new Set(); out = out.filter((o) => { const k = o.vals.map(key).join("|"); return !seen.has(k) && seen.add(k); }); }
  });

  if (q.order.length) {
    const colIdx = (name) => columns.findIndex((c) => norm(c) === norm(name));
    const getters = q.order.map(({ e }) => {
      if (e.k === "field") {
        const i = colIdx(e.path[0]);
        const isAlias = first.srcs.some((s) => s.alias === norm(e.path[0]));
        if (i >= 0 && (e.path.length === 1 || !isAlias)) return (o) => deref(o.vals[i], e.path.slice(1), e.pos);
      }
      if (!single) fail("В объединении УПОРЯДОЧИТЬ ПО может ссылаться только на псевдонимы колонок результата", e.pos);
      return (o) => ev(e, { srcs: first.srcs, row: o.row, ctx, outer, group: o.group });
    });
    out = out.map((o) => ({ o, k: getters.map((g) => g(o)) }))
      .sort((a, b) => { for (let i = 0; i < getters.length; i++) { const x = compare(a.k[i], b.k[i]); if (x) return q.order[i].desc ? -x : x; } return 0; })
      .map((x) => x.o);
  }
  if (single && q.selects[0].top !== null) out = out.slice(0, q.selects[0].top);
  const res = { columns, rows: out.map((o) => o.vals) };

  if (q.totals) {
    const T = q.totals; const ci = (e, what) => {
      if (e.k !== "field" || e.path.length !== 1) fail(`${what}: укажи имя колонки результата`, e.pos);
      const i = columns.findIndex((c) => norm(c) === norm(e.path[0]));
      if (i < 0) fail(`${what}: колонки «${e.path[0]}» нет в результате`, e.pos);
      return i;
    };
    const by = T.by.map((e) => ci(e, "ИТОГИ ПО"));
    const src = mkSource("Результат", columns, []);
    const aggs = T.aggs.map(({ e, alias }) => {
      let target = alias ? columns.findIndex((c) => norm(c) === norm(alias)) : -1;
      if (target < 0) walk(e, (n) => { if (target < 0 && n.k === "field") target = columns.findIndex((c) => norm(c) === norm(n.path[0])); });
      if (target < 0) fail("ИТОГИ: не удалось определить колонку для итога, задай псевдоним как у колонки результата", e.pos);
      return { e, target };
    });
    const asObj = (r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]));
    const rows = [], levels = [];
    const totalRow = (group, level, fill) => {
      const r = columns.map(() => undefined); fill(r);
      const c = { srcs: [src], row: [asObj(group[0])], ctx, group: group.map((g) => [asObj(g)]) };
      for (const a of aggs) r[a.target] = ev(a.e, c);
      rows.push(r); levels.push(level);
    };
    const rec = (group, depth, path) => {
      if (depth === by.length) { for (const r of group) { rows.push(r); levels.push(by.length + (T.overall ? 1 : 0)); } return; }
      const parts = new Map();
      for (const r of group) { const k = key(r[by[depth]]); if (!parts.has(k)) parts.set(k, []); parts.get(k).push(r); }
      for (const g of parts.values()) {
        const p = [...path, [by[depth], g[0][by[depth]]]];
        totalRow(g, depth + (T.overall ? 1 : 0), (r) => p.forEach(([i, v]) => { r[i] = v; }));
        rec(g, depth + 1, p);
      }
    };
    if (res.rows.length) { if (T.overall) totalRow(res.rows, 0, () => {}); rec(res.rows, 0, []); }
    res.rows = rows; res.levels = levels; res.depth = by.length + (T.overall ? 1 : 0);
  }
  return res;
}

/** Выполнить пакет запросов. params: объект {Имя: значение}. */
export function execute(text, params = {}) {
  const batch = parse(text);
  const ctx = { temp: new Map(), params: new Map(Object.entries(params).map(([k, v]) => [norm(k), v])) };
  const results = [];
  for (const q of batch) {
    if (q.drop) {
      if (!ctx.temp.delete(norm(q.drop))) fail(`УНИЧТОЖИТЬ: временной таблицы «${q.drop}» нет`, 0);
      results.push({ kind: "drop", name: q.drop, text: q.text });
      continue;
    }
    const res = runQuery(q, ctx);
    const into = q.selects[0].into;
    if (into) {
      if (ctx.temp.has(norm(into))) fail(`Временная таблица «${into}» уже существует`, q.selects[0].pos);
      if (getTable(into)) fail(`Имя «${into}» занято`, q.selects[0].pos);
      ctx.temp.set(norm(into), { columns: res.columns, rows: res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]]))) });
      results.push({ kind: "temp", name: into, text: q.text, ...res });
    } else results.push({ kind: "result", text: q.text, ...res });
  }
  const last = [...results].reverse().find((r) => r.kind === "result") ?? null;
  return { results, last };
}

/** Имена параметров (&Имя) в порядке появления. */
export function paramNames(text) {
  const seen = new Map();
  try { for (const t of lex(text)) if (t.t === "param" && !seen.has(norm(t.v))) seen.set(norm(t.v), t.v); } catch { /* незакрытая строка — покажет execute */ }
  return [...seen.values()];
}

/** Значение параметра из строки: 31.03.2026, 100, "текст", ЗНАЧЕНИЕ(Справочник.Склады.Основной), Справочник.Склады.Основной; список через «;». */
export function parseValue(text) {
  const one = (s) => {
    s = s.trim();
    if (!s) fail("Пустое значение параметра", 0);
    const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return D(+m[3], +m[2], +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
    if (/^[\p{L}]+\.[\p{L}\p{N}_.]+$/u.test(s) && predefined(s) !== undefined) return predefined(s);
    const p = new Parser(s); const e = p.expr();
    if (p.tok.t !== "eof") fail(`Лишний текст в значении параметра: «${p.tok.v}»`, p.tok.pos);
    return ev(e, { srcs: [], row: [], ctx: { temp: new Map(), params: new Map() } });
  };
  const parts = text.split(";").map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts.map(one) : one(text);
}

/** Сравнение двух результатов для автопроверки. */
export function sameResult(a, b, { ordered = false, names = false } = {}) {
  if (!a || !b) return { ok: false, why: "Запрос не вернул результат" };
  if (a.columns.length !== b.columns.length) return { ok: false, why: `Ожидалось колонок: ${b.columns.length}, получено: ${a.columns.length}` };
  if (names) for (let i = 0; i < a.columns.length; i++) if (norm(a.columns[i]) !== norm(b.columns[i])) return { ok: false, why: `Колонка №${i + 1} должна называться «${b.columns[i]}», а называется «${a.columns[i]}»` };
  if (a.rows.length !== b.rows.length) return { ok: false, why: `Ожидалось строк: ${b.rows.length}, получено: ${a.rows.length}` };
  const k = (r) => r.map((v) => (typeof v === "number" ? "n" + Math.round(v * 100) / 100 : key(v))).join("|");
  const x = a.rows.map(k), y = b.rows.map(k);
  if (!ordered) { x.sort(); y.sort(); }
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return { ok: false, why: ordered ? `Строка ${i + 1} отличается от ожидаемой (проверь значения и порядок сортировки)` : "Набор строк отличается от ожидаемого" };
  return { ok: true };
}

export function lineCol(text, pos) {
  const before = text.slice(0, pos ?? 0).split("\n");
  return { line: before.length, col: before[before.length - 1].length + 1 };
}
export { presentation };
