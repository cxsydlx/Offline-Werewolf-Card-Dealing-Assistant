import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDeviceStore } from "../store/deviceStore";
import { useGameStore } from "../store/gameStore";
import { api } from "../api/client";
import QRCode from "qrcode";
import WerewolfCard from "../components/game/WerewolfCard";

interface RoomState {
  view: string;
  accountId: number | null;
  isHost: boolean;
  isMember: boolean;
  room: any;
  game: any;
  preferences: any[];
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { bindings } = useDeviceStore();
  const { roleDefinitions, fetchRoleDefinitions } = useGameStore();
  const [st, setSt] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState(""); const [showQR, setShowQR] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ id: number; name: string } | null>(null);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [selectedRoles, setSelectedRoles] = useState<Set<number>>(new Set());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const ht = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ih = useRef(false);

  useEffect(() => { fetchRoleDefinitions(); }, []);

  // 当对局已有角色配置（继承上轮或已保存）时，同步到 counts
  useEffect(() => {
    const roles = st?.game?.roles;
    if (roles && roles.length > 0) {
      const existing = new Map<number, number>();
      for (const r of roles) existing.set(r.roleId, r.count);
      let dirty = counts.size === 0;
      if (!dirty) {
        for (const [rid, c] of existing) { if (counts.get(rid) !== c) { dirty = true; break; } }
      }
      if (dirty) {
        setCounts(existing);
        setShowRoleEditor(false);
      }
    }
  }, [st?.game?.id]);

  // 500ms 轮询统一状态
  useEffect(() => {
    if (!code) return;
    let stop = false; let timer: any;
    const poll = async () => {
      if (stop) return;
      try {
        const d: any = await api.get(`/rooms/${code}/state`);
        if (d?.ok) setSt(d);
        // 新对局重置本地状态
        if (!d?.game) { setCounts(new Map()); setSelectedRoles(new Set()); setAssignments([]); }
      } catch (e: any) { setError(e.status === 404 ? "房间不存在" : (e.message || "连接失败，正在重试...")); }
    };
    poll(); timer = setInterval(poll, 500);
    return () => { stop = true; clearInterval(timer); };
  }, [code]);

  const v = st?.view; const isHost = st?.isHost; const game = st?.game; const room = st?.room;
  const gid = game?.id;

  // 操作后立即刷新状态
  const refresh = async () => {
    try {
      const d: any = await api.get(`/rooms/${code}/state`);
      if (d?.ok) setSt(d);
      if (!d?.game) { setCounts(new Map()); setSelectedRoles(new Set()); setAssignments([]); }
    } catch (_) {}
  };

  // 操作函数
  const startGame = async () => { try { await api.post(`/rooms/${code}/games`); await refresh(); setError(""); } catch (e: any) { setError(e.message); } };
  const endGame = async () => { if (!gid || !confirm("结束本轮？")) return; try { await api.post(`/games/${gid}/end`); await refresh(); } catch (e: any) { setError(e.message); } };
  const closeRoom = async () => { if (!confirm("关闭房间？")) return; await api.post(`/rooms/${code}/close`); navigate("/lobby"); };
  const kick = async () => { if (!kickTarget) return; try { await api.post(`/rooms/${code}/kick`, { targetAccountId: kickTarget.id }); await refresh(); setKickTarget(null); } catch (e: any) { setError(e.message); } };

  const playerCount = game?.players?.length || 0;
  const totalRoles = [...counts.values()].reduce((s: number, c: number) => s + c, 0);
  const rolesOk = totalRoles === playerCount && playerCount > 0;
  const adj = (id: number, d: number) => { const n = new Map(counts); n.set(id, Math.max(0, Math.min((n.get(id) || 0) + d, playerCount))); setCounts(n); };

  const saveRoles = async () => {
    if (!gid) { setError("对局未初始化"); return; }
    if (!rolesOk) { setError(`数量不匹配(${totalRoles}/${playerCount})`); return; }
    try { await api.put(`/games/${gid}/roles`, { roles: [...counts.entries()].filter(([,c])=>c>0).map(([rid,c])=>({roleId:rid,count:c})) }); setShowRoleEditor(false); await refresh(); setError(""); } catch (e: any) { setError(e.message); }
  };

  const submitPref = async () => {
    if (!gid) return;
    const myPlayer = game?.players?.find((p: any) => p.accountId === st?.accountId);
    if (!myPlayer) return;
    try {
      if (isHost) await api.post(`/games/${gid}/start`);
      await api.post(`/games/${gid}/preferences`, { gamePlayerId: myPlayer.playerId, preferredRoleIds: [...selectedRoles] });
      await refresh();
      setError("");
    } catch (e: any) { setError(e.message); }
  };

  const startPreferencePhase = async () => { if (!gid) return; try { await api.post(`/games/${gid}/start`); await refresh(); setError(""); } catch (e: any) { setError(e.message); } };

  const doDist = async () => { if (!gid) return; try { const d: any = await api.post(`/games/${gid}/distribute`); setAssignments(d.assignments || []); } catch (e: any) { setError(e.message); } };
  const doApprove = async () => { if (!gid) return; try { await api.post(`/games/${gid}/distribute/approve`); await refresh(); setAssignments([]); } catch (e: any) { setError(e.message); } };

  const hd = useCallback(() => { ih.current = true; ht.current = setTimeout(() => { if (ih.current) setRevealed(true); }, 300); }, []);
  const hu = useCallback(() => { ih.current = false; if (ht.current) clearTimeout(ht.current); setRevealed(false); }, []);

  const showQRCode = async () => { setQrData(await QRCode.toDataURL(`${location.origin}/room/${code}`, { width: 240, margin: 2 })); setShowQR(true); };

  if (!st) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted animate-pulse">加载中...</p></div>;

  const sl: Record<string, string> = { waiting: "等待开始", playing: "对局中", between_games: "局间休息", closed: "已关闭" };
  const prefs = st.preferences || [];
  const allSubmitted = prefs.length > 0 && prefs.every((p: any) => p.hasPreference);
  const subCount = prefs.filter((p: any) => p.hasPreference).length;

  return (
    <div className="px-4 py-6 animate-in">
      {/* 状态栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="badge badge-gold">{sl[room?.status || "waiting"]}</span>
          {game && <span className="badge badge-gold ml-2">第{game.roundNumber}轮</span>}
          {isHost && <span className="badge badge-gold ml-2">主持</span>}
        </div>
        <span className={`badge ${v === "playing" ? "badge-green" : ""}`}>
          {v === "host_setup" ? "角色配置" : v === "host_distribution" ? "分配" : v === "player_preferences" ? "偏好" : v === "playing" ? "进行中" : v === "ended" ? "已结束" : ""}
        </span>
      </div>
      {error && <div className="glass mb-4 p-3 border-red-500/30 text-sm text-red-400">{error}</div>}

      {/* ====== LOBBY ====== */}
      {v === "lobby" && (
        <>
          <div className="text-center mb-4"><div className="flex items-center justify-center gap-3 mb-3"><button onClick={showQRCode} className="btn btn-sm btn-ghost">📷</button></div><div className="text-4xl font-bold font-mono tracking-[0.25em] text-gold">{code}</div></div>
          <WerewolfCard className="mb-5 !p-5">
            <p className="text-xs text-muted mb-3 uppercase tracking-wider">成员 · {room?.players.length || 0}人</p>
            {room?.players.map((p: any) => (
              <div key={p.accountId} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.02]">
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/05 border border-amber-500/15 flex items-center justify-center text-sm font-bold text-gold">{p.name[0]}</div><span className="text-sm font-medium">{p.name}</span>{p.accountId === st?.accountId && <span className="badge badge-gold text-[0.6rem]">我</span>}</div>
                <div className="flex items-center gap-1">{p.isHost && <span className="badge badge-gold text-[0.6rem]">主持</span>}{isHost && !p.isHost && <button onClick={() => setKickTarget({ id: p.accountId, name: p.name })} className="text-xs text-muted hover:text-red-400 px-1.5 py-1">✕</button>}</div>
              </div>
            ))}
          </WerewolfCard>
          {(room?.history?.length || 0) > 0 && <WerewolfCard className="mb-5 !p-5"><p className="text-xs text-muted mb-3 uppercase tracking-wider">历史</p>{room.history.map((g: any) => <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5"><span className="text-sm">🌙 第{g.roundNumber}轮</span><span className="text-xs text-muted">{g.status==="ended"?"已结束":g.status}</span></div>)}</WerewolfCard>}
          <div className="space-y-3">
            {isHost && (room?.status === "waiting" || room?.status === "between_games") && <button onClick={startGame} className="btn btn-primary btn-lg w-full btn-glow">{room?.status==="waiting"?"🎭 开始第一轮":"🔄 开始下一轮"}</button>}
            {!isHost && room?.status === "between_games" && <WerewolfCard className="text-center !p-5"><p className="text-sm text-muted">等待主持人开始下一局...</p></WerewolfCard>}
            {isHost && <button onClick={closeRoom} className="btn btn-danger w-full">关闭房间</button>}
          </div>
        </>
      )}

      {/* ====== HOST SETUP (角色配置) ====== */}
      {v === "host_setup" && game && (
        <>
          {(game.roles?.length || 0) === 0 || showRoleEditor ? (
            <><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">角色配置</h2><span className={`badge ${rolesOk?"badge-green":"badge-red"}`}>{totalRoles}/{playerCount}</span></div><div className="space-y-2 mb-6">{roleDefinitions.map((r: any) => {const c=counts.get(r.id)||0;const fb=r.faction==="werewolf"?"badge-red":r.faction==="villager"?"badge-green":r.faction==="neutral"?"badge-neutral":"badge-purple";return(<WerewolfCard key={r.id} className="!p-3 !flex items-center justify-between" isActive={c>0}><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className={`badge ${fb} text-[0.6rem]`}>{r.name}</span></div><p className="text-xs text-muted mt-1 truncate">{r.skillDescription}</p></div><div className="flex items-center gap-2 ml-2 shrink-0"><button onClick={()=>adj(r.id,-1)} disabled={c===0} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-lg disabled:opacity-20">−</button><span className="w-5 text-center font-mono text-sm">{c}</span><button onClick={()=>adj(r.id,1)} disabled={totalRoles>=playerCount} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-lg disabled:opacity-20">+</button></div></WerewolfCard>)})}</div><button onClick={saveRoles} className="btn btn-primary btn-lg w-full btn-glow">保存角色配置</button></>
          ) : (
            <><WerewolfCard className="mb-5 !p-5" isActive><div className="flex items-center justify-between mb-3"><p className="text-xs text-muted uppercase tracking-wider">本轮角色 · {playerCount}人</p><button onClick={()=>setShowRoleEditor(true)} className="text-xs text-gold">调整</button></div><div className="grid grid-cols-2 gap-2">{(game.roles||[]).map((gr:any)=>{const fb=gr.faction==="werewolf"?"badge-red":gr.faction==="villager"?"badge-green":"badge-purple";return(<div key={gr.roleId} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5"><span className={`badge ${fb} text-[0.6rem]`}>{gr.roleName}</span><span className="text-sm font-mono text-secondary">×{gr.count}</span></div>)})}</div></WerewolfCard>
            {game.spectatorMode ? (
              <WerewolfCard className="!p-5 text-center"><p className="text-sm text-secondary mb-4">角色配置完成，可以开始收集玩家偏好</p><button onClick={startPreferencePhase} className="btn btn-primary btn-lg w-full btn-glow">开始收集偏好</button></WerewolfCard>
            ) : (
              <div><h2 className="text-lg font-bold mb-2">你的身份偏好</h2><p className="text-sm text-muted mb-6">选择你希望获得的身份</p><div className="grid grid-cols-2 gap-3 mb-6">{(game.roles||[]).map((gr:any)=>{const sel=selectedRoles.has(gr.roleId);return(<button key={gr.roleId} onClick={()=>{const n=new Set(selectedRoles);sel?n.delete(gr.roleId):n.add(gr.roleId);setSelectedRoles(n)}} className={`p-4 rounded-2xl border text-left transition-all ${sel?"glass-active":"glass"}`}><span className="font-semibold text-sm">{gr.roleName}</span><div className="text-xs text-muted">×{gr.count}</div></button>)})}</div><div className="flex items-center justify-between mb-4 text-sm text-muted"><span>已选{selectedRoles.size}个</span><button onClick={()=>setSelectedRoles(new Set())} className="text-gold">清除</button></div><button onClick={submitPref} className="btn btn-primary btn-lg w-full btn-glow">提交偏好并开始收集</button></div>
            )}
            </>
          )}
        </>
      )}

      {/* ====== PLAYER PREFERENCES ====== */}
      {v === "player_preferences" && game && (
        <>
          <h2 className="text-lg font-bold mb-2">身份偏好</h2>
          <p className="text-sm text-muted mb-6">选择你希望获得的身份</p>
          <div className="grid grid-cols-2 gap-3 mb-6">{(game.roles||[]).map((gr:any)=>{const sel=selectedRoles.has(gr.roleId);return(<button key={gr.roleId} onClick={()=>{const n=new Set(selectedRoles);sel?n.delete(gr.roleId):n.add(gr.roleId);setSelectedRoles(n)}} className={`p-4 rounded-2xl border text-left transition-all ${sel?"glass-active":"glass"}`}><span className="font-semibold text-sm">{gr.roleName}</span><div className="text-xs text-muted">×{gr.count}</div></button>)})}</div>
          <div className="flex items-center justify-between mb-4 text-sm text-muted"><span>已选{selectedRoles.size}个</span><button onClick={()=>setSelectedRoles(new Set())} className="text-gold">清除</button></div>
          <button onClick={submitPref} className="btn btn-primary btn-lg w-full btn-glow">提交偏好</button>
        </>
      )}

      {/* ====== WAITING DISTRIBUTION ====== */}
      {v === "waiting_distribution" && <WerewolfCard className="mb-5 !p-6 text-center"><p className="text-lg mb-2">✅</p><p className="text-sm text-secondary">偏好已提交，等待分配...</p></WerewolfCard>}

      {/* ====== HOST DISTRIBUTION ====== */}
      {v === "host_distribution" && game && (
        <>
          <h2 className="text-lg font-bold mb-2">身份分配</h2>
          <p className="text-sm text-muted mb-4">{subCount}/{prefs.length}人已提交{allSubmitted&&" ✅"}</p>
          {!assignments.length ? (
            <WerewolfCard className="mb-5 !p-5"><p className="text-xs text-muted mb-3 uppercase tracking-wider">偏好状态</p>{prefs.map((p:any)=><div key={p.playerId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"><span className="text-sm">{p.accountName}</span><span className={`badge ${p.hasPreference?"badge-green":"badge-red"} text-[0.6rem]`}>{p.hasPreference?"已提交":"未提交"}</span></div>)}<button onClick={doDist} disabled={!allSubmitted} className="btn btn-primary btn-lg w-full mt-4">{!allSubmitted?`等待${prefs.length-subCount}人...`:"🎲 随机分配"}</button></WerewolfCard>
          ) : (
            <WerewolfCard isActive className="mb-5 !p-5"><p className="text-xs text-gold mb-3 uppercase tracking-wider">分配结果</p>{assignments.map((a:any)=><div key={a.playerId} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"><span className="text-sm font-medium">{a.accountName}</span><span className={`role-tag ${a.roleFaction||"villager"}`}>{a.roleName}</span></div>)}<div className="flex gap-2 mt-4"><button onClick={doDist} className="btn btn-ghost flex-1">🔄 重分</button><button onClick={doApprove} className="btn btn-primary flex-1">✅ 确认</button></div></WerewolfCard>
          )}
        </>
      )}

      {/* ====== PLAYING ====== */}
      {v === "playing" && game && (
        <>
          {game.myRole?.roleName && (
            <div className="flex justify-center mb-6" onPointerDown={hd} onPointerUp={hu} onPointerLeave={hu}>
              <div className="identity-card"><div className={`identity-blur-layer ${revealed?"revealed":"blurred"}`}><div className="identity-text"><div className="identity-role-name">{game.myRole.roleName}</div><div className="identity-skill">{game.myRole.skillDescription||""}</div></div></div></div>
            </div>
          )}
          {!game.myRole?.roleName && !isHost && <WerewolfCard className="mb-5 !p-6 text-center"><p className="text-lg mb-2">🎭</p><p className="text-sm text-secondary">等待分配身份...</p></WerewolfCard>}
          <WerewolfCard className="mb-5 !p-5"><p className="text-xs text-muted mb-3 uppercase tracking-wider">玩家状态</p><div className="grid grid-cols-3 gap-2">{game.players.map((p:any)=><div key={p.playerId} className={`p-3 rounded-xl text-center border transition-all ${!p.isAlive?"border-red-500/10 bg-red-500/[0.03] opacity-50":"border-white/5"} ${p.accountId===st?.accountId?"border-amber-500/30 bg-amber-500/[0.04]":""}`}><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-muted mt-0.5">#{p.seatNumber}</div>{!p.isAlive&&<div className="text-xs mt-1 text-red-400">💀</div>}{isHost&&game.spectatorMode&&p.roleName&&<div className="text-xs text-gold mt-1">{p.roleName}</div>}</div>)}</div></WerewolfCard>
          {isHost && <WerewolfCard className="!p-5" isActive><p className="text-xs text-muted mb-3 uppercase tracking-wider">主持面板</p><button onClick={endGame} className="btn btn-danger w-full">结束本轮</button></WerewolfCard>}
        </>
      )}

      {/* ====== ENDED ====== */}
      {v === "ended" && game && (
        <>
          <WerewolfCard className="mb-5 !p-6 text-center" isActive><div className="text-4xl mb-3">🏆</div><h3 className="text-lg font-bold mb-2">本轮结束·亮牌</h3></WerewolfCard>
          <WerewolfCard className="mb-5 !p-5"><p className="text-xs text-muted mb-3 uppercase tracking-wider">身份揭晓</p>{game.players.map((p:any)=><div key={p.playerId} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"><div className="flex items-center gap-3"><span className="text-sm">{p.name}</span>{!p.isAlive&&<span className="text-xs text-red-400">💀</span>}</div><span className={`role-tag ${p.roleFaction||"villager"}`}>{p.roleName||"未分配"}</span></div>)}</WerewolfCard>
        </>
      )}

      {showQR&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={()=>setShowQR(false)}><div onClick={e=>e.stopPropagation()}><WerewolfCard className="!p-6 text-center animate-slide-up mx-4 max-w-xs"><h3 className="font-bold mb-2">房间{code}</h3>{qrData&&<img src={qrData} alt="QR" className="w-56 h-56 mx-auto rounded-xl"/>}<button onClick={()=>setShowQR(false)} className="btn btn-ghost w-full mt-4">关闭</button></WerewolfCard></div></div>}
      {kickTarget&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={()=>setKickTarget(null)}><div onClick={e=>e.stopPropagation()}><WerewolfCard className="!p-6 text-center animate-slide-up mx-4 max-w-xs"><h3 className="font-bold mb-2">踢出{kickTarget.name}</h3><button onClick={kick} className="btn btn-danger w-full mb-2">确认</button><button onClick={()=>setKickTarget(null)} className="btn btn-ghost w-full">取消</button></WerewolfCard></div></div>}
    </div>
  );
}
