// Достижения, значки и звания. Всё выводится из прогресса — отдельно хранится только момент получения.
import { tasks, quizTopics, queryTasks, kbArticles } from "./content.js";
import { chapters, allLevels, bosses } from "../game/levels.js";

const quizTotal = quizTopics.reduce((n, t) => n + t.questions.length, 0);
const diff = Object.fromEntries(tasks.map((t) => [t.id, t.difficulty ?? 1]));
const qdiff = Object.fromEntries(queryTasks.map((t) => [t.id, t.difficulty ?? 1]));

export function summary(d) {
  const quizRight = Object.values(d.quiz).filter(Boolean).length;
  const stars = Object.values(d.game).reduce((a, b) => a + b, 0);
  const xp = d.solved.reduce((s, id) => s + 10 * (diff[id] ?? 1), 0) + d.queries.reduce((s, id) => s + 12 * (qdiff[id] ?? 1), 0)
    + quizRight * 2 + stars * 5 + d.bosses.length * 40 + d.kb.length * 3;
  return {
    xp, quizRight, quizAnswered: Object.keys(d.quiz).length, quizTotal, stars, starsTotal: allLevels.length * 3,
    tasks: d.solved.length, tasksTotal: tasks.length, queries: d.queries.length, queriesTotal: queryTasks.length,
    levels: Object.keys(d.game).length, levelsTotal: allLevels.length, bosses: d.bosses.length, bossesTotal: bosses.length,
    kb: d.kb.length, kbTotal: kbArticles.length,
  };
}

export const ranks = [
  { xp: 0, title: "Стажёр", icon: "🐾" },
  { xp: 150, title: "Джуниор", icon: "🌱" },
  { xp: 500, title: "Мидл", icon: "⚙️" },
  { xp: 1100, title: "Сеньор", icon: "🏔️" },
  { xp: 1900, title: "Тимлид", icon: "👑" },
];
export function rankOf(xp) {
  const i = ranks.findLastIndex((r) => xp >= r.xp);
  const next = ranks[i + 1] ?? null;
  return { ...ranks[i], index: i, next, progress: next ? (xp - ranks[i].xp) / (next.xp - ranks[i].xp) : 1 };
}

const chapterDone = (d, c) => c.levels.every((l) => d.game[l.id]) && d.bosses.includes(c.boss.id);
const topicDone = (d, t) => t.questions.every((q) => d.quiz[q.id]);

export const achievements = [
  { id: "first-task", icon: "✅", title: "Первая кровь", text: "Решить первую задачу практики", test: (d) => d.solved.length >= 1 },
  { id: "tasks-10", icon: "🔟", title: "Десятка", text: "Решить 10 задач практики", test: (d) => d.solved.length >= 10 },
  { id: "tasks-all", icon: "🏆", title: "Практик", text: "Решить все задачи практики", test: (d) => d.solved.length >= tasks.length },
  { id: "first-query", icon: "🔎", title: "ВЫБРАТЬ ПЕРВЫЕ 1", text: "Решить первую задачу на запросы", test: (d) => d.queries.length >= 1 },
  { id: "queries-10", icon: "📊", title: "Аналитик", text: "Решить 10 задач на запросы", test: (d) => d.queries.length >= 10 },
  { id: "queries-all", icon: "🧠", title: "Оптимизатор", text: "Решить все задачи на запросы", test: (d) => d.queries.length >= queryTasks.length },
  { id: "console-25", icon: "⌨️", title: "Консольщик", text: "Выполнить 25 запросов в консоли", test: (d) => (d.stats.consoleRuns ?? 0) >= 25 },
  { id: "temp-table", icon: "🗂️", title: "ПОМЕСТИТЬ втУспех", text: "Выполнить в консоли пакет с временной таблицей", test: (d) => (d.stats.tempTables ?? 0) >= 1 },
  { id: "virtual", icon: "🧮", title: "Виртуоз", text: "Обратиться в консоли к виртуальной таблице регистра", test: (d) => (d.stats.virtualTables ?? 0) >= 1 },
  { id: "quiz-25", icon: "📚", title: "Теоретик", text: "Верно ответить на 25 вопросов", test: (d) => Object.values(d.quiz).filter(Boolean).length >= 25 },
  { id: "quiz-100", icon: "🎓", title: "Профессор", text: "Верно ответить на 100 вопросов", test: (d) => Object.values(d.quiz).filter(Boolean).length >= 100 },
  { id: "quiz-streak", icon: "🔥", title: "Серия", text: "10 верных ответов подряд", test: (d) => (d.stats.quizStreak ?? 0) >= 10 },
  { id: "quiz-topic", icon: "🎯", title: "Тема закрыта", text: "Верно ответить на все вопросы одной темы", test: (d) => quizTopics.some((t) => topicDone(d, t)) },
  { id: "kb-5", icon: "📖", title: "Читатель", text: "Открыть 5 статей базы знаний", test: (d) => d.kb.length >= 5 },
  { id: "kb-all", icon: "🦉", title: "Энциклопедист", text: "Открыть все статьи базы знаний", test: (d) => d.kb.length >= kbArticles.length },
  { id: "game-start", icon: "🧢", title: "Кепка надета", text: "Пройти первый уровень игры", test: (d) => Object.keys(d.game).length >= 1 },
  { id: "first-boss", icon: "🐷", title: "Свин повержен", text: "Победить первого босса", test: (d) => d.bosses.length >= 1 },
  { id: "flawless", icon: "💎", title: "Без единой ошибки", text: "Победить босса, не потеряв ни одной жизни", test: (d) => (d.stats.flawlessBosses ?? 0) >= 1 },
  { id: "stars-60", icon: "⭐", title: "Звездопад", text: "Собрать 60 звёзд в игре", test: (d) => Object.values(d.game).reduce((a, b) => a + b, 0) >= 60 },
  { id: "all-bosses", icon: "🐆", title: "Хозяин гор", text: "Победить всех боссов", test: (d) => d.bosses.length >= bosses.length },
  { id: "radio", icon: "🎧", title: "Под lo-fi", text: "Включить радио", test: (d) => (d.stats.radio ?? 0) >= 1 },
];

/** Значки: по одному за каждую пройденную тему игры (уровни + босс). */
export const badges = chapters.map((c) => ({ id: `badge-${c.id}`, title: c.title, text: `Тема «${c.topic}»: все уровни и босс «${c.boss.name}»`, color: c.color, skin: c.boss.skin, test: (d) => chapterDone(d, c) }));

export const evaluateAchievements = (d) => achievements.filter((a) => { try { return a.test(d); } catch { return false; } });
