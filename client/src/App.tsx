import { useEffect, useState, useCallback } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useDeviceStore } from "./store/deviceStore";
import LandingPage from "./pages/LandingPage";
import AccountManagementPage from "./pages/AccountManagementPage";
import LobbyPage from "./pages/LobbyPage";
import RoomPage from "./pages/RoomPage";
import Starfield from "./components/layout/Starfield";
import ErrorBoundary from "./components/layout/ErrorBoundary";

export default function App() {
  const { registerDevice, fetchBindings } = useDeviceStore();
  const [isFS, setIsFS] = useState(false);

  useEffect(() => { registerDevice().then(() => fetchBindings()); }, []);

  // 监听原生全屏变化（按 F11 或 Esc 时同步）
  useEffect(() => {
    const onChange = () => setIsFS(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // 不支持原生全屏时，切换 CSS 全屏模式
      setIsFS((v) => !v);
    }
  }, []);

  return (
    <div className={`relative min-h-screen ${isFS ? "app-fullscreen" : ""}`}>
      <Starfield />
      <div className="app-orbs"><div className="app-orb app-orb--1" /><div className="app-orb app-orb--2" /><div className="app-orb app-orb--3" /></div>

      {/* 全屏切换按钮 */}
      <button onClick={toggleFullscreen}
        className="fixed top-3 right-3 z-[60] w-9 h-9 rounded-xl glass flex items-center justify-center text-sm text-secondary hover:text-gold transition-all"
        title={isFS ? "退出全屏" : "全屏"}>
        {isFS ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        )}
      </button>

      <div className="relative z-10 max-w-lg mx-auto min-h-screen pb-20">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/accounts" element={<AccountManagementPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/room/:code" element={<RoomPage />} />
          </Routes>
        </ErrorBoundary>
      </div>
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
