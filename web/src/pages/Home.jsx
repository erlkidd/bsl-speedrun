import { Link } from "react-router-dom";
import { tasks, quizTopics, kbArticles } from "../lib/content.js";
import { progress } from "../lib/api.js";
import { highlightBsl } from "../components/Markdown.jsx";
import { plural, TASKS, QUESTIONS, ARTICLES } from "../lib/plural.js";

const sample = `Функция СуммаМассива(Массив)
	Сумма = 0;
	Для Каждого Элемент Из Массив Цикл
		Сумма = Сумма + Элемент;
	КонецЦикла;
	Возврат Сумма;
КонецФункции`;

export default function Home() {
  const solved = progress.solved();
  const qCount = quizTopics.reduce((n, t) => n + t.questions.length, 0);
  return (
    <div className="page home">
      <section className="hero">
        <div>
          <p className="eyebrow">тренажёр 1С-разработчика</p>
          <h1>Пиши на BSL каждый день, пока не станет на автомате</h1>
          <p className="lead">Задачи с автопроверкой, песочница с настоящим OneScript и линтером BSL LS, тесты по теории и шпаргалки по платформе и БСП.</p>
          <div className="cta">
            <Link className="btn primary" to="/practice">Решать задачи</Link>
            <Link className="btn" to="/sandbox">Открыть песочницу</Link>
          </div>
        </div>
        <pre className="code hero-code"><code dangerouslySetInnerHTML={{ __html: highlightBsl(sample) }} /><span className="pass">✓ 4/4 тестов пройдено</span></pre>
      </section>
      <section className="cards">
        <Link to="/practice" className="card"><b>Практика</b><span>{plural(tasks.length, TASKS)} · решено {solved.size}</span><p>Условие, подсказки, решение. Проверка: синтаксис → правила задачи → тесты.</p></Link>
        <Link to="/sandbox" className="card"><b>Песочница</b><span>OneScript</span><p>Любой BSL-код: коллекции, строки, даты, вывод через Сообщить().</p></Link>
        <Link to="/theory" className="card"><b>Теория</b><span>{plural(qCount, QUESTIONS)}</span><p>Неверный ответ — сразу видно правильный и почему.</p></Link>
        <Link to="/kb" className="card"><b>База знаний</b><span>{plural(kbArticles.length, ARTICLES)}</span><p>Платформа, язык и БСП коротко и с примерами.</p></Link>
      </section>
    </div>
  );
}
