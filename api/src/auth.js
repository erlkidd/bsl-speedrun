// Профили: имя + пароль, сессии по токену, прогресс одним JSON на пользователя.
// Хранилище — один файл в DATA_DIR (том docker), запись атомарная (tmp + rename).
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const FILE = join(DATA_DIR, "users.json");
const SESSION_TTL = 1000 * 60 * 60 * 24 * 60; // 60 дней
const MAX_PROGRESS = 200 * 1024;
// Сброс пароля по одному логину, без подтверждений — так задумано на этом этапе.
// Отключается переменной ALLOW_OPEN_RESET=0, когда появится почта/подтверждение.
const OPEN_RESET = process.env.ALLOW_OPEN_RESET !== "0";

let db = { users: {}, sessions: {} };
try { if (existsSync(FILE)) db = JSON.parse(readFileSync(FILE, "utf8")); } catch { /* повреждённый файл — начинаем с пустого */ }
db.users ??= {}; db.sessions ??= {};

let timer = null;
function persist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(FILE + ".tmp", JSON.stringify(db));
      renameSync(FILE + ".tmp", FILE);
    } catch (e) { console.error("users.json: не удалось сохранить —", e.message); }
  }, 300);
}

const sha = (s) => createHash("sha256").update(s).digest("hex");
const hashPassword = (password, salt) => scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
const keyOf = (login) => login.trim().toLowerCase();
const LOGIN_RE = /^[\p{L}\p{N}_.-]{3,24}$/u;

function checkCredentials(body) {
  const login = typeof body?.login === "string" ? body.login.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!LOGIN_RE.test(login)) return { error: "Имя: 3–24 символа — буквы, цифры, точка, дефис, подчёркивание" };
  if (password.length < 6 || password.length > 72) return { error: "Пароль: от 6 до 72 символов" };
  return { login, password };
}
function openSession(login) {
  const token = randomBytes(32).toString("hex");
  db.sessions[sha(token)] = { login: keyOf(login), exp: Date.now() + SESSION_TTL };
  persist();
  return token;
}
function dropSessions(key) {
  for (const [h, s] of Object.entries(db.sessions)) if (s.login === key) delete db.sessions[h];
}
function auth(req) {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? "");
  if (!m) return null;
  const h = sha(m[1]);
  const s = db.sessions[h];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[h]; persist(); return null; }
  const user = db.users[s.login];
  return user ? { user, hash: h } : null;
}

export function registerAuth(app) {
  // отдельный, более строгий лимит на попытки входа/регистрации/сброса
  const tries = new Map();
  const limited = (req) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip || "local";
    const now = Date.now();
    const arr = (tries.get(ip) || []).filter((t) => now - t < 60_000);
    arr.push(now); tries.set(ip, arr);
    return arr.length > 10;
  };
  setInterval(() => { const now = Date.now(); for (const [k, v] of tries) if (v.every((t) => now - t > 60_000)) tries.delete(k); }, 60_000).unref();
  const tooMany = (reply) => reply.code(429).send({ error: "Слишком много попыток, подожди минуту" });

  app.post("/api/auth/register", async (req, reply) => {
    if (limited(req)) return tooMany(reply);
    const c = checkCredentials(req.body);
    if (c.error) return reply.code(400).send({ error: c.error });
    const key = keyOf(c.login);
    if (db.users[key]) return reply.code(409).send({ error: "Такое имя уже занято" });
    const salt = randomBytes(16).toString("hex");
    db.users[key] = { login: c.login, salt, hash: hashPassword(c.password, salt), created: Date.now(), progress: {}, updated: 0 };
    return { login: c.login, token: openSession(c.login), progress: {} };
  });

  app.post("/api/auth/login", async (req, reply) => {
    if (limited(req)) return tooMany(reply);
    const c = checkCredentials(req.body);
    const user = c.error ? null : db.users[keyOf(c.login)];
    const ok = user && timingSafeEqual(Buffer.from(hashPassword(c.password, user.salt), "hex"), Buffer.from(user.hash, "hex"));
    if (!ok) return reply.code(401).send({ error: "Неверное имя или пароль" });
    return { login: user.login, token: openSession(user.login), progress: user.progress ?? {} };
  });

  app.post("/api/auth/reset", async (req, reply) => {
    if (limited(req)) return tooMany(reply);
    if (!OPEN_RESET) return reply.code(403).send({ error: "Сброс пароля отключён администратором" });
    const c = checkCredentials(req.body);
    if (c.error) return reply.code(400).send({ error: c.error });
    const key = keyOf(c.login);
    const user = db.users[key];
    if (!user) return reply.code(404).send({ error: "Профиль с таким именем не найден" });
    user.salt = randomBytes(16).toString("hex");
    user.hash = hashPassword(c.password, user.salt);
    dropSessions(key); // старые входы перестают действовать
    return { login: user.login, token: openSession(user.login), progress: user.progress ?? {} };
  });

  app.post("/api/auth/logout", async (req) => {
    const a = auth(req);
    if (a) { delete db.sessions[a.hash]; persist(); }
    return { ok: true };
  });

  app.get("/api/progress", async (req, reply) => {
    const a = auth(req);
    if (!a) return reply.code(401).send({ error: "Нужен вход" });
    return { login: a.user.login, progress: a.user.progress ?? {}, updated: a.user.updated ?? 0 };
  });

  app.put("/api/progress", { bodyLimit: MAX_PROGRESS + 1024 }, async (req, reply) => {
    const a = auth(req);
    if (!a) return reply.code(401).send({ error: "Нужен вход" });
    const p = req.body?.progress;
    if (!p || typeof p !== "object" || Array.isArray(p)) return reply.code(400).send({ error: "Нет данных прогресса" });
    if (JSON.stringify(p).length > MAX_PROGRESS) return reply.code(413).send({ error: "Прогресс слишком большой" });
    a.user.progress = p;
    a.user.updated = Date.now();
    persist();
    return { ok: true, updated: a.user.updated };
  });
}
