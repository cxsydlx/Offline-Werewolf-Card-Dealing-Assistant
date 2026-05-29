import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useDeviceStore } from "../store/deviceStore";
import { api } from "../api/client";
import WerewolfCard from "../components/game/WerewolfCard";

const DEBUG_KEY = "werewolf_debug";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { accounts, fetchAccounts } = useGameStore();
  const { bindings } = useDeviceStore();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [joinCode, setJoinCode] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(() => localStorage.getItem(DEBUG_KEY) === "1");
  const [showDev, setShowDev] = useState(false);
  const [pollMs, setPollMs] = useState(() => Number(localStorage.getItem("werewolf_poll_ms") || 550));

  useEffect(() => { fetchAccounts(); loadSearch(); }, []);

  const toggleDebug = () => {
    const next = !debug;
    setDebug(next);
    localStorage.setItem(DEBUG_KEY, next ? "1" : "0");
  };

  const loadSearch = async () => {
    try { setSearchResults((await api.get<{ ok: boolean; rooms: any[] }>("/rooms/search")).rooms || []); } catch (_) {}
  };

  const boundId = bindings[0]?.accountId;
  const selectable = accounts.filter((a) => a.id !== boundId && !a.inActiveGame);
  const total = selectedIds.size + 1;
  const minPlayers = debug ? 2 : 6;
  const valid = total >= minPlayers && total <= 12;

  const toggle = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : total < 12 && next.add(id);
    setSelectedIds(next);
  };

  const createRoom = async () => {
    if (!valid) return;
    try {
      setError("");
      const data = await api.post<{ ok: boolean; room: any }>("/rooms", {
        participantAccountIds: [...selectedIds],
        hostPlays: false,
        debug,
      });
      navigate(`/room/${data.room.code}`);
    } catch (e: any) { setError(e.message); }
  };

  const joinRoom = async (code?: string) => {
    const c = (code || joinCode).trim().toUpperCase();
    if (!c) return;
    const accountId = bindings[0]?.accountId;
    if (!accountId) { setError("请先绑定账号"); return; }
    try {
      await api.post(`/rooms/${c}/join`, { accountId });
      navigate(`/room/${c}`);
    } catch (e: any) { setError(e.message || "无法加入房间"); }
  };

  const filtered = searchResults.filter((r) =>
    !searchQuery || r.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 py-6 animate-in">
      <h2 className="text-2xl font-bold mb-6">游戏大厅</h2>

      {error && <div className="glass mb-4 p-3 border-red-500/30 text-sm text-red-400">{error}</div>}

      {/* 调试模式 */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <div>
          <p className="text-xs font-medium">🐛 调试模式</p>
          <p className="text-[0.65rem] text-muted">允许 {minPlayers}~12 人开局（正常 6~12）</p>
        </div>
        <button onClick={toggleDebug}
          className={`relative w-12 h-7 rounded-full transition-all duration-200 ${debug ? "bg-amber-500 shadow-[0_0_12px_rgba(212,168,67,0.3)]" : "bg-white/10"}`}>
          <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200 ${debug ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      {/* 创建房间 */}
      <WerewolfCard className="mb-4 !p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">创建房间</h3>
          <span className={`badge ${valid ? "badge-gold" : "badge-red"}`}>{total}/{minPlayers}+</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 mb-4 max-h-36 overflow-y-auto">
          {selectable.map((a) => (
            <button key={a.id} onClick={() => toggle(a.id)}
              className={`p-2.5 rounded-xl text-xs border transition-all ${
                selectedIds.has(a.id) ? "border-amber-500/40 bg-amber-500/10 text-amber-400 font-semibold" : "border-white/5 text-secondary hover:border-white/10"
              }`}>
              {a.nickname || a.name}
            </button>
          ))}
        </div>
        <button onClick={createRoom} disabled={!valid} className="btn btn-primary w-full">
          创建房间 ({total}人，纯主持模式)
        </button>
      </WerewolfCard>

      {/* 加入房间 */}
      <WerewolfCard className="mb-4 !p-5">
        <h3 className="font-semibold text-sm mb-3">加入房间</h3>
        <div className="flex gap-2 mb-3">
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="输入房间号" className="input flex-1 text-center text-lg tracking-[0.25em] font-mono" maxLength={6} />
        </div>
        <button onClick={() => joinRoom()} className="btn btn-primary w-full">加入房间</button>
      </WerewolfCard>

      {/* 搜索房间 */}
      <button onClick={() => { setShowSearch(!showSearch); loadSearch(); }} className="btn btn-ghost w-full mb-4">
        {showSearch ? "收起搜索" : "🔍 搜索公开房间"}
      </button>

      {showSearch && (
        <WerewolfCard className="!p-5 animate-in">
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索房间号..." className="input mb-3 text-sm" />
          {filtered.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">
              {searchResults.length === 0 ? "暂无等待中的房间" : "无匹配房间"}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filtered.map((r) => (
                <div key={r.code} className="flex items-center justify-between p-3 rounded-xl border border-white/5 hover:border-amber-500/20 transition-colors">
                  <div>
                    <div className="text-sm font-mono tracking-[0.15em] text-gold">{r.code}</div>
                    <div className="text-xs text-muted">{r.hostName} · {r.playerCount}人</div>
                  </div>
                  <button onClick={() => joinRoom(r.code)} className="btn btn-sm btn-primary">加入</button>
                </div>
              ))}
            </div>
          )}
        </WerewolfCard>
      )}

      {/* 开发模式 */}
      <button onClick={() => setShowDev(!showDev)} className="btn btn-ghost w-full mb-4 text-xs">
        🛠 {showDev ? "收起" : "开发工具"}
      </button>
      {showDev && (
        <WerewolfCard className="!p-5 mb-4">
          <p className="text-xs text-muted mb-3 uppercase tracking-wider">开发调试</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-secondary mb-2">轮询刷新速度</p>
              <div className="flex gap-2">
                {[
                  { ms: 300, label: "0.3s" },
                  { ms: 500, label: "0.5s" },
                  { ms: 1000, label: "1s" },
                  { ms: 2000, label: "2s" },
                ].map(({ ms, label }) => (
                  <button key={ms}
                    onClick={() => {
                      if ((ms === 300 || ms === 500) && pollMs !== ms) {
                        const speed = ms === 300 ? "0.3秒" : "0.5秒";
                        if (confirm(`你真的要改成${speed}吗？\n\n这样会对我的服务器造成很大压力的 🤦\n\n[确定] = 关我屁事\n[取消] = 就此作罢`)) {
                          // 关我屁事
                        } else {
                          alert("你人真好，其实是我骗你的 😂");
                        }
                      }
                      localStorage.setItem("werewolf_poll_ms", String(ms)); setPollMs(ms);
                    }}
                    className={`flex-1 btn btn-sm ${pollMs === ms ? "btn-primary" : "btn-ghost"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={async () => {
              if (!confirm("确定重置所有数据？这将删除所有对局、房间、绑定和自定义账号。")) return;
              try { await api.post("/rooms/dev/reset"); alert("已重置！请刷新页面"); window.location.reload(); }
              catch (e: any) { alert(e.message); }
            }} className="btn btn-danger w-full btn-sm">🗑 重置所有数据</button>
            <p className="text-[0.6rem] text-muted">删除所有对局、房间、设备绑定和自定义账号</p>
          </div>
        </WerewolfCard>
      )}

      {/* 我的房间 */}
      <button onClick={async () => {
        try {
          const d: any = await api.get("/rooms/my/list");
          if ((d.rooms || []).length === 0) { setError("你没有加入任何房间"); return; }
          setSearchResults(d.rooms);
          setShowSearch(true);
        } catch (e: any) { setError(e.message); }
      }} className="btn btn-ghost w-full mb-4">
        📋 我的房间
      </button>

    </div>
  );
}
