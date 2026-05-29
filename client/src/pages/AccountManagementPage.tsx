import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../store/gameStore";
import { useDeviceStore } from "../store/deviceStore";
import { api } from "../api/client";
import WerewolfCard from "../components/game/WerewolfCard";

export default function AccountManagementPage() {
  const navigate = useNavigate();
  const { accounts, fetchAccounts } = useGameStore();
  const { bindings, bindAccount, transferBinding, unbindAccount } = useDeviceStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editNick, setEditNick] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { fetchAccounts(); }, []);

  const currentBoundId = bindings[0]?.accountId;

  const afterBind = () => {
    // 回到首页，由 LandingPage 查询服务器获取真实房间状态
    navigate("/");
  };

  const handleBind = async (id: number) => {
    try {
      setError("");
      await bindAccount(id);
      await fetchAccounts();
      afterBind();
    } catch (e: any) {
      if (e.data?.requiresTransfer) {
        if (confirm("该账号已绑定到其他设备，是否强制转移？")) {
          await transferBinding(id);
          await fetchAccounts();
          afterBind();
        }
      } else setError(e.message);
    }
  };

  const handleUnbind = async (id: number) => {
    await unbindAccount(id);
    await fetchAccounts();
  };

  const addCustom = async () => {
    if (!newName.trim()) return;
    try { await api.post("/accounts/custom", { name: newName.trim() }); setNewName(""); setShowAdd(false); await fetchAccounts(); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div className="px-4 py-6 animate-in">
      <h2 className="text-2xl font-bold mb-4">账号管理</h2>

      {error && <div className="glass mb-4 p-3 border-red-500/30 text-sm text-red-400">{error}</div>}

      {currentBoundId && (
        <WerewolfCard className="mb-5 !p-4 flex items-center gap-3" isActive>
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(46,204,113,0.5)]" />
          <span className="text-sm text-secondary">
            当前: <span className="text-white font-semibold">{accounts.find((a) => a.id === currentBoundId)?.name}</span>
          </span>
        </WerewolfCard>
      )}

      <div className="space-y-2">
        {accounts.map((a) => (
          <WerewolfCard key={a.id} className="!p-4 !flex items-center justify-between" isActive={a.bindingStatus === "current_device"}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{a.nickname || a.name}</span>
                {a.nickname && <span className="text-xs text-muted">({a.name})</span>}
                {a.isFixed && <span className="badge badge-blue text-[0.6rem]">固定</span>}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {a.bindingStatus === "current_device" && "✨ 当前设备"}
                {a.bindingStatus === "other_device" && "🔒 其他设备"}
                {a.bindingStatus === "unbound" && "未绑定"}
              </p>
            </div>
            <div className="flex gap-1.5 ml-2 shrink-0">
              {a.bindingStatus === "unbound" && (
                <button onClick={() => handleBind(a.id)} disabled={!!currentBoundId} className="btn btn-sm">绑定</button>
              )}
              {a.bindingStatus === "current_device" && (
                <>
                  <button onClick={() => setEditNick({ id: a.id, name: a.nickname || a.name })} className="btn btn-sm btn-ghost">改名</button>
                  <button onClick={() => handleUnbind(a.id)} className="btn btn-sm btn-danger">解绑</button>
                </>
              )}
              {a.bindingStatus === "other_device" && (
                <button onClick={() => { if (confirm("强制转移？")) { transferBinding(a.id).then(() => fetchAccounts()).then(afterBind); } }} className="btn btn-sm btn-ghost">转移</button>
              )}
              {!a.isFixed && <button onClick={async () => { if (confirm("删除？")) { await api.delete(`/accounts/custom/${a.id}`); await fetchAccounts(); } }} className="btn btn-sm btn-danger">🗑</button>}
            </div>
          </WerewolfCard>
        ))}
      </div>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="w-full mt-4 py-3 border border-dashed border-white/10 rounded-xl text-muted text-sm">+ 添加自定义玩家</button>
      ) : (
        <WerewolfCard className="mt-4 !p-4 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="输入玩家名" className="input" maxLength={50} />
          <div className="flex gap-2">
            <button onClick={addCustom} className="btn btn-primary flex-1 btn-sm">确认</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-ghost flex-1 btn-sm">取消</button>
          </div>
        </WerewolfCard>
      )}

      {/* 改名弹窗 */}
      {editNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditNick(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm mx-4">
          <WerewolfCard className="!p-6 space-y-4 animate-slide-up">
            <h3 className="font-bold">修改名称</h3>
            <input value={editNick.name} onChange={(e) => setEditNick({ ...editNick, name: e.target.value })} className="input" maxLength={50} autoFocus />
            <div className="flex gap-2">
              <button onClick={async () => { await api.put(`/accounts/${editNick.id}/rename`, { name: editNick.name }); setEditNick(null); await fetchAccounts(); }} className="btn btn-primary flex-1">保存</button>
              <button onClick={() => setEditNick(null)} className="btn btn-ghost flex-1">取消</button>
            </div>
          </WerewolfCard>
          </div>
        </div>
      )}
    </div>
  );
}
