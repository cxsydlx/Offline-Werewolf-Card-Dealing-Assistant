import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  role?: string;
  style?: React.CSSProperties;
}

export default function WerewolfCard({ children, isActive, onClick, className = "", role, style }: Props) {
  return (
    <div
      onClick={onClick}
      className={`transition-all duration-200 ${isActive ? "glass-active" : "glass"} ${onClick ? "cursor-pointer active:scale-[0.98]" : ""} ${className}`}
      style={{
        padding: "16px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function getRoleColors(role: string) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    werewolf: { bg: "rgba(231,76,60,0.15)", color: "#E74C3C", border: "rgba(231,76,60,0.4)" },
    wolf_king: { bg: "rgba(231,76,60,0.12)", color: "#FF6B6B", border: "rgba(231,76,60,0.35)" },
    dreamweaver: { bg: "rgba(142,68,173,0.15)", color: "#BB8FCE", border: "rgba(142,68,173,0.35)" },
    seer: { bg: "rgba(52,152,219,0.15)", color: "#5DADE2", border: "rgba(52,152,219,0.35)" },
    witch: { bg: "rgba(155,89,182,0.15)", color: "#C39BD3", border: "rgba(155,89,182,0.35)" },
    hunter: { bg: "rgba(230,126,34,0.15)", color: "#F0B27A", border: "rgba(230,126,34,0.35)" },
    guard: { bg: "rgba(26,188,156,0.15)", color: "#48C9B0", border: "rgba(26,188,156,0.35)" },
    knight: { bg: "rgba(52,73,94,0.15)", color: "#85929E", border: "rgba(52,73,94,0.35)" },
    magician: { bg: "rgba(41,128,185,0.15)", color: "#85C1E9", border: "rgba(41,128,185,0.35)" },
    fool: { bg: "rgba(241,196,15,0.15)", color: "#F9E79F", border: "rgba(241,196,15,0.35)" },
    villager: { bg: "rgba(46,204,113,0.12)", color: "#58D68D", border: "rgba(46,204,113,0.3)" },
  };
  return map[role] || map.villager;
}

export function RoleTag({ role, className = "" }: { role: string; className?: string }) {
  const c = getRoleColors(role);
  return (
    <span
      className={`role-tag ${role} ${className}`}
      style={c as any}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: c.color,
        boxShadow: `0 0 6px ${c.color}`,
      }} />
      {role}
    </span>
  );
}
