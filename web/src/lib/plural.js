// Русское склонение по числу: plural(21, ["задача", "задачи", "задач"]) → "21 задача"
export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  const word = a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
  return `${n} ${word}`;
}

export const TASKS = ["задача", "задачи", "задач"];
export const QUESTIONS = ["вопрос", "вопроса", "вопросов"];
export const ARTICLES = ["статья", "статьи", "статей"];
