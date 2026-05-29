import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeviceStore } from "../store/deviceStore";
import { useGameStore } from "../store/gameStore";
import { api } from "../api/client";
import WerewolfCard from "../components/game/WerewolfCard";

export default function LandingPage() {
  const navigate = useNavigate();
  const { fingerprint, bindings, fetchBindings } = useDeviceStore();
  const { fetchAccounts } = useGameStore();
  const [checking, setChecking] = useState(true);
  const [myRooms, setMyRooms] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      await fetchBindings();
      await fetchAccounts();
      setChecking(false);
    };
    init();
  }, []);

  // 有绑定账号后，每 2 秒轮询该玩家的房间状态
  useEffect(() => {
    if (bindings.length === 0) { setMyRooms([]); return; }
    let stop = false; let timer: any;
    const poll = async () => {
      if (stop) return;
      try {
        const d = await api.get<{ ok: boolean; rooms: any[] }>("/rooms/my/list");
        if (!stop) setMyRooms(d.rooms || []);
      } catch (_) {}
      if (!stop) timer = setTimeout(poll, 550);
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [bindings]);

  const activeRoom = myRooms.find((r) => r.status === "playing" && r.currentGameId);
  const waitingRoom = myRooms.find((r) => r.status === "waiting" || r.status === "between_games");

  const [actionError, setActionError] = useState("");

  const leaveRoom = async (code: string) => {
    try {
      setActionError("");
      await api.post(`/rooms/${code}/leave`, { accountId: bindings[0]?.accountId });
      setMyRooms((prev) => prev.filter((r) => r.code !== code));
    } catch (e: any) { setActionError(e.message || "操作失败"); }
  };

  const closeRoom = async (code: string) => {
    if (!confirm("关闭房间后所有人都将退出，确定？")) return;
    try {
      setActionError("");
      await api.post(`/rooms/${code}/close`);
      setMyRooms((prev) => prev.filter((r) => r.code !== code));
    } catch (e: any) { setActionError(e.message || "操作失败"); }
  };

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/08 border border-amber-500/15 flex items-center justify-center text-3xl animate-pulse">🐺</div>
        <p className="text-muted text-sm">识别设备中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-600/05 border border-amber-500/15 flex items-center justify-center text-5xl"
          style={{ boxShadow: "0 0 48px rgba(212,168,67,0.06)" }}>🐺</div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight"
          style={{ background: "linear-gradient(135deg, #EDEEF2 0%, #D4A843 45%, #BF8F35 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          狼人杀
        </h1>
        <p className="text-base text-secondary tracking-[0.15em]">熟人局助手</p>
      </div>

      {actionError && <div className="glass w-full mb-4 p-3 border-red-500/30 text-sm text-red-400">{actionError}</div>}

      {/* 进行中的对局 */}
      {activeRoom && (
        <WerewolfCard isActive className="w-full mb-4 !p-5 text-left">
          <p className="text-sm text-gold font-semibold mb-2">⚡ 检测到进行中的对局</p>
          <div className="text-xs text-muted space-y-1 mb-4">
            <p>房间 {activeRoom.code} · {activeRoom.hostName} · {activeRoom.playerCount}人</p>
            {activeRoom.currentRound && <p>当前第 {activeRoom.currentRound} 轮</p>}
          </div>
          <div className="space-y-2">
            <button onClick={() => navigate(`/room/${activeRoom.code}`)} className="btn btn-primary btn-lg w-full btn-glow">
              进入对局
            </button>
            {activeRoom.isHost ? (
              <button onClick={() => closeRoom(activeRoom.code)} className="btn btn-danger w-full text-sm">
                关闭房间
              </button>
            ) : (
              <button onClick={() => leaveRoom(activeRoom.code)} className="btn btn-danger w-full text-sm">
                退出对局
              </button>
            )}
          </div>
        </WerewolfCard>
      )}

      {/* 等待中的房间 */}
      {waitingRoom && !activeRoom && (
        <WerewolfCard className="w-full mb-4 !p-5 text-left">
          <p className="text-sm text-secondary mb-2">📍 你有一个等待中的房间</p>
          <div className="text-xs text-muted mb-4">房间 {waitingRoom.code} · {waitingRoom.hostName} · {waitingRoom.playerCount}人</div>
          <div className="space-y-2">
            <button onClick={() => navigate(`/room/${waitingRoom.code}`)} className="btn btn-primary btn-lg w-full">
              进入房间
            </button>
            {waitingRoom.isHost ? (
              <button onClick={() => closeRoom(waitingRoom.code)} className="btn btn-ghost w-full text-sm">
                关闭房间
              </button>
            ) : (
              <button onClick={() => leaveRoom(waitingRoom.code)} className="btn btn-ghost w-full text-sm">
                离开
              </button>
            )}
          </div>
        </WerewolfCard>
      )}

      <div className="w-full space-y-3">
        <button onClick={() => navigate("/lobby")} className={`${activeRoom ? "btn btn-ghost" : "btn btn-primary btn-lg"} w-full`}>
          进入大厅
        </button>
        <button onClick={() => navigate("/accounts")} className="btn btn-ghost w-full">账号管理</button>
      </div>

      {bindings.length > 0 && (
        <WerewolfCard className="w-full mt-8 !p-3 !rounded-xl">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(46,204,113,0.4)]" />
            {bindings[0].accountName}
            <span className="ml-auto font-mono text-[0.6rem]">{fingerprint.slice(0, 12)}...</span>
          </div>
        </WerewolfCard>
      )}
    </div>
  );
}
