import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useDeviceStore } from "./store/deviceStore";
import LandingPage from "./pages/LandingPage";
import AccountManagementPage from "./pages/AccountManagementPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";
import Starfield from "./components/layout/Starfield";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import ElasticOverscroll from "./components/layout/ElasticOverscroll";

export default function App() {
  const { registerDevice, fetchBindings } = useDeviceStore();
  const [isFS, setIsFS] = useState(false);

  useEffect(() => { registerDevice().then(() => fetchBindings()); }, []);

  // 每 30 秒检测版本更新，有新版则自动刷新
  useEffect(() => {
    let currentVersion = "";
    let stop = false; let timer: any;
    const check = async () => {
      try {
        const res = await fetch("/version.json?t=" + Date.now());
        const data = await res.json();
        if (!currentVersion) { currentVersion = data.t; return; }
        if (data.t !== currentVersion) { window.location.reload(); }
      } catch (_) {}
      if (!stop) timer = setTimeout(check, 30000);
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // 监听原生全屏变化（按 F11 或 Esc 时同步）
  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const next = !isFS;
    setIsFS(next);
    // 同时尝试原生全屏 API（桌面端）
    try {
      if (!next && document.fullscreenElement) {
        document.exitFullscreen();
      } else if (next && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      }
    } catch (_) {}
    // 全屏时禁止 body 滚动
    document.body.style.overflow = next ? "hidden" : "";
  }, [isFS]);

  return (
    <div className={`relative min-h-screen ${isFS ? "app-fullscreen" : ""}`}>
      <Starfield />
      <div className="app-orbs"><div className="app-orb app-orb--1" /><div className="app-orb app-orb--2" /><div className="app-orb app-orb--3" /></div>

      <ElasticOverscroll>
        <div className="relative z-10 max-w-lg mx-auto min-h-screen pb-20">

          {/* 全屏切换 */}
          <div className="flex justify-end px-3 pt-3">
            <button onClick={toggleFullscreen}
              className="px-3 py-1.5 rounded-lg glass text-xs text-secondary hover:text-gold transition-all">
              {isFS ? "退出全屏" : "进入全屏"}
            </button>
          </div>

          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/accounts" element={<AccountManagementPage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/room/:code" element={<RoomPage />} />
            </Routes>
          </ErrorBoundary>
          <footer className="text-center py-6 mt-8 text-[0.6rem] text-muted space-y-1">
            <p><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">鄂ICP备2025159094号-2</a></p>
            <p><a href="https://www.beian.gov.cn/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">鄂公网安备42130202448233号</a></p>
          </footer>
        </div>
      </ElasticOverscroll>
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
        <div className="glass-nav mx-4 mb-3 rounded-2xl shadow-lg">
          <div className="flex justify-around py-3 px-2">
            <Link to="/" className="flex flex-col items-center gap-1 text-secondary hover:text-gold transition-colors px-4 py-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span className="text-[0.65rem]">首页</span></Link>
            <Link to="/accounts" className="flex flex-col items-center gap-1 text-secondary hover:text-gold transition-colors px-4 py-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg><span className="text-[0.65rem]">账号</span></Link>
            <Link to="/lobby" className="flex flex-col items-center gap-1 text-secondary hover:text-gold transition-colors px-4 py-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span className="text-[0.65rem]">对局</span></Link>
          </div>
        </div>
      </nav>
    </div>
  );
}
