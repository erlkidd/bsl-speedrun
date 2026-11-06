import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import "./styles/app.css";
import Home from "./pages/Home.jsx";
import Practice from "./pages/Practice.jsx";
import Theory from "./pages/Theory.jsx";
import { Kb, KbArticle } from "./pages/Kb.jsx";

// страницы с Monaco грузятся отдельно — база знаний и квиз остаются лёгкими
const TaskPage = lazy(() => import("./pages/TaskPage.jsx"));
const Sandbox = lazy(() => import("./pages/Sandbox.jsx"));

function Layout({ children }) {
  return (
    <>
      <header className="top">
        <Link to="/" className="logo" aria-label="bsl speedrun — на главную">
          <picture>
            <source srcSet="/logo-dark.svg" media="(prefers-color-scheme: dark)" />
            <img src="/logo-light.svg" alt="bsl speedrun" width="158" height="36" />
          </picture>
        </Link>
        <nav>
          <NavLink to="/practice">Практика</NavLink>
          <NavLink to="/sandbox">Песочница</NavLink>
          <NavLink to="/theory">Теория</NavLink>
          <NavLink to="/kb">База знаний</NavLink>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="foot">bsl-speedrun.kz · код выполняет <a href="https://oscript.io" target="_blank" rel="noreferrer">OneScript</a>, линтер — <a href="https://1c-syntax.github.io/bsl-language-server/" target="_blank" rel="noreferrer">BSL Language Server</a></footer>
    </>
  );
}

const Loading = () => <div className="page"><p className="muted">Загрузка редактора…</p></div>;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/:id" element={<TaskPage />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="/theory" element={<Theory />} />
            <Route path="/kb" element={<Kb />} />
            <Route path="/kb/:section/:slug" element={<KbArticle />} />
            <Route path="*" element={<div className="page"><h1>404</h1><p>Такой страницы нет. <Link to="/">На главную</Link></p></div>} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
);
