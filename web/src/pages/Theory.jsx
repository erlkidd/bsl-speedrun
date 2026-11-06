import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { quizTopics } from "../lib/content.js";
import { progress } from "../lib/api.js";
import Markdown from "../components/Markdown.jsx";
import { plural, QUESTIONS } from "../lib/plural.js";

function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export default function Theory() {
  const [topicId, setTopicId] = useState(null);
  if (!topicId) return <TopicList onPick={setTopicId} />;
  const topic = topicId === "*" ? { topic: "Все темы вперемешку", questions: quizTopics.flatMap((t) => t.questions) } : quizTopics.find((t) => t.id === topicId);
  return <Quiz key={topicId} topic={topic} onExit={() => setTopicId(null)} />;
}

function TopicList({ onPick }) {
  const stats = progress.quiz();
  return (
    <div className="page">
      <h1>Теория</h1>
      <p className="muted">Выбери тему. Неверный ответ — сразу покажем правильный и объясним почему.</p>
      <div className="cards">
        {quizTopics.map((t) => {
          const answered = t.questions.filter((q) => q.id in stats);
          const right = answered.filter((q) => stats[q.id]).length;
          return (
            <button key={t.id} className="card" onClick={() => onPick(t.id)}>
              <b>{t.topic}</b><span>{plural(t.questions.length, QUESTIONS)}{answered.length ? ` · верно ${right}/${answered.length}` : ""}</span>
            </button>
          );
        })}
        <button className="card accent" onClick={() => onPick("*")}><b>Все темы</b><span>случайный порядок</span></button>
      </div>
    </div>
  );
}

function Quiz({ topic, onExit }) {
  const questions = useMemo(() => shuffle(topic.questions).map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, order };
  }), [topic]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const q = questions[i];

  if (!q) {
    return (
      <div className="page quiz">
        <h1>Готово: {score} из {questions.length}</h1>
        <p className="muted">{score === questions.length ? "Идеально." : "Ошибки — повод перечитать базу знаний."}</p>
        <button className="btn primary" onClick={onExit}>К темам</button>
      </div>
    );
  }

  const choose = (idx) => {
    if (picked !== null) return;
    setPicked(idx);
    const ok = idx === q.answer;
    if (ok) setScore(score + 1);
    progress.saveQuizAnswer(q.id, ok);
  };

  return (
    <div className="page quiz">
      <div className="quiz-head">
        <button className="btn ghost" onClick={onExit}>← Темы</button>
        <span className="muted">{topic.topic} · {i + 1}/{questions.length} · верно {score}</span>
      </div>
      <div className="progress"><i style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <h2 className="question"><Markdown text={q.q} /></h2>
      <div className="options">
        {q.order.map((idx) => {
          const cls = picked === null ? "" : idx === q.answer ? "right" : idx === picked ? "wrong" : "dim";
          return <button key={idx} className={`option ${cls}`} onClick={() => choose(idx)}><Markdown text={String(q.options[idx])} /></button>;
        })}
      </div>
      {picked !== null && (
        <div className={`explain ${picked === q.answer ? "ok" : "bad"}`}>
          <b>{picked === q.answer ? "Верно." : "Неверно."}</b>
          {picked !== q.answer && <> Правильный ответ: <em>{q.options[q.answer]}</em></>}
          <Markdown text={q.explain} />
          {q.kb && <Link to={`/kb/${q.kb}`}>Подробнее в базе знаний →</Link>}
          <div><button className="btn primary" onClick={() => { setI(i + 1); setPicked(null); }} autoFocus>Дальше →</button></div>
        </div>
      )}
    </div>
  );
}
