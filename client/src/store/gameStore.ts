import { create } from "zustand";
import { api } from "../api/client";

export interface AccountInfo {
  id: number;
  name: string;
  isFixed: boolean;
  nickname?: string;
  bindingStatus: "unbound" | "current_device" | "other_device";
  inActiveGame: boolean;
}

export interface RoomInfo {
  id: number;
  code: string;
  hostAccountId: number;
  status: string;
  currentGameId: number | null;
  players: Array<{
    id: number;
    accountId: number;
    accountName: string;
    nickname?: string;
    isHost: boolean;
    joinedAt: string;
  }>;
  games: Array<{
    id: number;
    roundNumber: number;
    status: string;
  }>;
  createdAt: string;
}

export interface GameInfo {
  id: number;
  roomId: number;
  roundNumber: number;
  status: string;
  playerCount: number;
  spectatorMode: boolean;
  players: Array<{
    id: number;
    accountId: number;
    accountName: string;
    nickname?: string;
    seatNumber: number;
    roleId?: number;
    roleName?: string;
    roleFaction?: string;
    isAlive: boolean;
    isHost: boolean;
    hasPreference: boolean;
  }>;
  roles: Array<{
    roleId: number;
    roleKey: string;
    roleName: string;
    faction: string;
    count: number;
  }>;
}

interface GameStore {
  // 账号
  accounts: AccountInfo[];
  accountsLoading: boolean;
  // 房间
  currentRoom: RoomInfo | null;
  roomLoading: boolean;
  // 当前对局
  currentGame: GameInfo | null;
  gameLoading: boolean;
  // 全局角色库
  roleDefinitions: Array<{
    id: number;
    key: string;
    name: string;
    faction: string;
    description: string;
    skillDescription: string;
    modules: Array<any>;
  }>;
  // 我的身份
  myIdentity: { roleId: number; roleName: string; roleKey: string; faction: string; skillDescription: string } | null;

  fetchAccounts: () => Promise<void>;
  fetchRoom: (code: string) => Promise<void>;
  fetchGame: (gameId: number) => Promise<void>;
  fetchRoleDefinitions: () => Promise<void>;
  setMyIdentity: (identity: any) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  accounts: [],
  accountsLoading: false,
  currentRoom: null,
  roomLoading: false,
  currentGame: null,
  gameLoading: false,
  roleDefinitions: [],
  myIdentity: null,

  fetchAccounts: async () => {
    set({ accountsLoading: true });
    try {
      const data = await api.get<{ ok: boolean; accounts: AccountInfo[] }>("/accounts");
      set({ accounts: data.accounts });
    } finally {
      set({ accountsLoading: false });
    }
  },

  fetchRoom: async (code: string) => {
    set({ roomLoading: true });
    try {
      const data = await api.get<{ ok: boolean; room: RoomInfo }>(`/rooms/${code}`);
      set({ currentRoom: data.room });
    } finally {
      set({ roomLoading: false });
    }
  },

  fetchGame: async (gameId: number) => {
    set({ gameLoading: true });
    try {
      const data = await api.get<{ ok: boolean; game: GameInfo }>(`/games/${gameId}`);
      set({ currentGame: data.game });
    } finally {
      set({ gameLoading: false });
    }
  },

  fetchRoleDefinitions: async () => {
    try {
      const data = await api.get<{ ok: boolean; roles: any[] }>("/roles");
      set({ roleDefinitions: data.roles });
    } catch (_) {}
  },

  setMyIdentity: (identity) => set({ myIdentity: identity }),
}));
