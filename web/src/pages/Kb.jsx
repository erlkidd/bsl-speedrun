import { useEffect, useState } from "react";
import { progress } from "../lib/store.js";
import { Link, useParams } from "react-router-dom";
import { kbArticles, kbSections, getArticle } from "../lib/content.js";
import Markdown from "../components/Markdown.jsx";

export function Kb() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const match = (a) => !query || a.title.toLowerCase().includes(query) || a.body.toLowerCase().includes(query);
  return (
    <div className="page">
      <h1>База знаний</h1>
      <input className="search" placeholder="Поиск по статьям…" value={q} onChange={(e) => setQ(e.target.value)} />
      {kbSections.map((s) => {
        const list = kbArticles.filter((a) => a.section === s.id && match(a));
        if (!list.length) return null;
        return (
          <section key={s.id} className="kb-section">
            <h2>{s.title}</h2>
            <ul className="kb-list">
              {list.map((a) => <li key={a.slug}><Link to={`/kb/${a.section}/${a.slug}`}>{a.title}</Link></li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function KbArticle() {
  const { section, slug } = useParams();
  const a = getArticle(section, slug);
  useEffect(() => { if (a) progress.readKb(`${section}/${slug}`); }, [a, section, slug]);
  if (!a) return <div className="page"><h1>Статья не найдена</h1><Link to="/kb">К базе знаний</Link></div>;
  const siblings = kbArticles.filter((x) => x.section === section);
  const sec = kbSections.find((s) => s.id === section);
  return (
    <div className="page kb-article">
      <aside>
        <Link to="/kb" className="muted">← База знаний</Link>
        <h4>{sec?.title}</h4>
        <ul>{siblings.map((x) => <li key={x.slug} className={x.slug === slug ? "on" : ""}><Link to={`/kb/${section}/${x.slug}`}>{x.title}</Link></li>)}</ul>
      </aside>
      <article>
        <h1>{a.title}</h1>
        <Markdown text={a.body} />
      </article>
    </div>
  );
}
