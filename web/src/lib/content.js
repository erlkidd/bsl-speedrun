// Весь контент из /content подтягивается на этапе сборки.
import yaml from "js-yaml";

const raw = (g) => g; // для читаемости
const taskFiles = raw(import.meta.glob("../../../content/tasks/*/*.{yaml,md,os}", { query: "?raw", import: "default", eager: true }));
const quizFiles = raw(import.meta.glob("../../../content/quiz/*.yaml", { query: "?raw", import: "default", eager: true }));
const kbFiles = raw(import.meta.glob("../../../content/kb/*/*.md", { query: "?raw", import: "default", eager: true }));
const sandboxFiles = raw(import.meta.glob("../../../content/sandbox/*.os", { query: "?raw", import: "default", eager: true }));

// ---------- задачи ----------
const byTask = {};
for (const [path, text] of Object.entries(taskFiles)) {
  const m = path.match(/tasks\/([^/]+)\/([^/]+)$/);
  if (!m) continue;
  (byTask[m[1]] ??= {})[m[2]] = text;
}
export const tasks = Object.entries(byTask)
  .filter(([, f]) => f["meta.yaml"])
  .map(([id, f]) => ({
    id,
    ...yaml.load(f["meta.yaml"]),
    statement: f["task.md"] ?? "",
    starter: f["starter.os"] ?? "",
    solution: f["solution.os"] ?? "",
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
export const getTask = (id) => tasks.find((t) => t.id === id);

// ---------- квиз ----------
export const quizTopics = Object.entries(quizFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, text]) => {
    const data = yaml.load(text);
    const id = path.split("/").pop().replace(/\.yaml$/, "");
    return { id, topic: data.topic, questions: data.questions.map((q, i) => ({ ...q, id: `${id}#${i}` })) };
  });

// ---------- база знаний ----------
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  return { meta: yaml.load(m[1]) ?? {}, body: text.slice(m[0].length) };
}
export const kbSections = [
  { id: "general", title: "Платформа и язык" },
  { id: "bsp", title: "БСП" },
];
export const kbArticles = Object.entries(kbFiles)
  .map(([path, text]) => {
    const [, section, slug] = path.match(/kb\/([^/]+)\/([^/]+)\.md$/);
    const { meta, body } = frontmatter(text);
    return { section, slug, title: meta.title ?? slug, order: meta.order ?? 99, body };
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
export const getArticle = (section, slug) => kbArticles.find((a) => a.section === section && a.slug === slug);

// ---------- примеры песочницы ----------
export const sandboxExamples = Object.entries(sandboxFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, code]) => {
    const file = path.split("/").pop().replace(/\.os$/, "");
    const title = code.match(/^\/\/\s*(.+)/)?.[1] ?? file;
    return { id: file, title, code };
  });
