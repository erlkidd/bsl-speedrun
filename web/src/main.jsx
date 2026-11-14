import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from "react-router-dom";
import { useTheme, toggleTheme } from "./lib/theme.js";
import "./styles/app.css";
import Home from "./pages/Home.jsx";
import Practice from "./pages/Practice.jsx";
import Theory from "./pages/Theory.jsx";
import { Kb, KbArticle } from "./pages/Kb.jsx";
import { QueryConsole, QueryTaskList, QueryTaskRoute } from "./pages/Queries.jsx";
import Game from "./pages/Game.jsx";
import Profile from "./pages/Profile.jsx";
import BgFx from "./components/BgFx.jsx";
import { BarsikSkater } from "./game/sprites.jsx";
import RadioPlayer from "./components/RadioPlayer.jsx";
import Helper from "./components/Helper.jsx";
import { Toasts, ProfileChip, AuthGate } from "./components/Shell.jsx";

// страницы с Monaco грузятся отдельно — база знаний и квиз остаются лёгкими
const TaskPage = lazy(() => import("./pages/TaskPage.jsx"));
const Sandbox = lazy(() => import("./pages/Sandbox.jsx"));

function ThemeToggle() {
  const dark = useTheme() === "dark";
  return (
    <button className="theme-toggle" onClick={toggleTheme} role="switch" aria-checked={dark} aria-label="Тёмная тема" title={dark ? "Включить светлую тему" : "Включить тёмную тему"}>
      <span className="tt-knob" aria-hidden="true">{dark ? "🌙" : "☀️"}</span>
    </button>
  );
}

function Layout({ children }) {
  const theme = useTheme();
  const home = useLocation().pathname === "/";
  return (
    <>
      <BgFx />
      <header className="top">
        <Link to="/" className="logo" aria-label="bsl speedrun — на главную">
          <img src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"} alt="bsl speedrun" width="158" height="36" />
        </Link>
        <nav>
          <NavLink to="/practice">Практика</NavLink>
          <NavLink to="/queries">Запросы</NavLink>
          <NavLink to="/game">Игра</NavLink>
          <NavLink to="/sandbox">Песочница</NavLink>
          <NavLink to="/theory">Теория</NavLink>
          <NavLink to="/kb">База знаний</NavLink>
        </nav>
        <span className="top-right"><ThemeToggle /><ProfileChip /></span>
      </header>
      <main className={home ? "is-home" : ""}>{children}</main>
      <footer className="foot">
        <div className="bsl-band" aria-label="Что такое BSL — наша версия">
          <BarsikSkater size={104} />
          <div>
            <p className="bsl-kicker">BSL — это</p>
            <p className="bsl-title" aria-label="Barsik Spreads Language 1C"><span><b>B</b>arsik</span> <span><b>S</b>preads</span> <span><b>L</b>anguage</span> <span><b>1C</b></span></p>
          </div>
        </div>
        <div className="foot-info">
          <p>Автор — <b>Arthur Barmine</b></p>
          <p>bsl-speedrun.kz · <a href="https://github.com/erlkidd/bsl-speedrun" target="_blank" rel="noreferrer">исходники на GitHub</a></p>
          <p>код выполняет <a href="https://oscript.io" target="_blank" rel="noreferrer">OneScript</a>, линтер — <a href="https://1c-syntax.github.io/bsl-language-server/" target="_blank" rel="noreferrer">BSL Language Server</a> · радио: laut.fm, SomaFM</p>
        </div>
      </footer>
      <RadioPlayer pinned={home} />
      <Helper />
      <Toasts />
      <AuthGate />
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
            <Route path="/queries" element={<QueryConsole />} />
            <Route path="/queries/tasks" element={<QueryTaskList />} />
            <Route path="/queries/tasks/:id" element={<QueryTaskRoute />} />
            <Route path="/game" element={<Game />} />
            <Route path="/game/:chapter" element={<Game />} />
            <Route path="/game/:chapter/:level" element={<Game />} />
            <Route path="/profile" element={<Profile />} />
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
