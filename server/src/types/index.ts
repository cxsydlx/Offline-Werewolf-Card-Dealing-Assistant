// ============================================================
// 共享类型定义（前后端通用）
// ============================================================

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
  hostPlays: boolean;
  status: "waiting" | "playing" | "between_games" | "closed";
  currentGameId: number | null;
  players: RoomPlayerInfo[];
  games: GameSummary[];
  createdAt: string;
}

export interface RoomPlayerInfo {
  id: number;
  accountId: number;
  accountName: string;
  nickname?: string;
  isHost: boolean;
  joinedAt: string;
}

export interface GameSummary {
  id: number;
  roundNumber: number;
  status: string;
  playerCount: number;
  createdAt: string;
  endedAt?: string;
}

export interface GameInfo {
  id: number;
  roomId: number;
  roundNumber: number;
  hostAccountId: number;
  status: "setup" | "preference" | "playing" | "ended";
  playerCount: number;
  spectatorMode: boolean;
  players: GamePlayerInfo[];
  roles: GameRoleInfo[];
  createdAt: string;
  endedAt?: string;
}

export interface GamePlayerInfo {
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
  identityRevealed: boolean;
  hasPreference: boolean;
}

export interface GameRoleInfo {
  id: number;
  roleId: number;
  roleKey: string;
  roleName: string;
  faction: string;
  count: number;
}

export interface RoleWithModules {
  id: number;
  key: string;
  name: string;
  faction: string;
  description: string;
  skillDescription: string;
  icon: string | null;
  sortOrder: number;
  modules: ModuleInfo[];
}

export interface ModuleInfo {
  id: number;
  key: string;
  name: string;
  description: string;
  triggerOrder: number;
  targetSelectionType: "none" | "single" | "multiple";
  minTargets: number;
  maxTargets: number;
  allowSkip: boolean;
  resolutionType: string;
  defaultParams: any;
  enabledByDefault: boolean;
}

export interface GameModuleInfo {
  id: number;
  moduleDefinitionId: number;
  moduleKey: string;
  moduleName: string;
  enabled: boolean;
  triggerOrder: number;
  params?: any;
}

export interface NightRoundInfo {
  id: number;
  gameId: number;
  roundNumber: number;
  phase: string;
  status: "in_progress" | "resolved" | "dawn";
  startedAt: string;
  endedAt?: string;
}

export interface NightActionInfo {
  id: number;
  nightRoundId: number;
  gameModuleId: number;
  actionType: string;
  sequenceNumber: number;
  isUndone: boolean;
  actorPlayerId: number;
  actorName?: string;
  targetPlayerIds: number[];
  targetNames?: string[];
  resultData?: any;
}

export interface DawnResultInfo {
  id: number;
  gamePlayerId: number;
  playerName: string;
  isDead: boolean;
  causeOfDeath?: string;
  investigationResult?: string;
  otherEffects?: any;
}

export interface ModulePrompt {
  nightRoundId: number;
  gameModuleId: number;
  moduleName: string;
  moduleDescription: string;
  eligibleActors: { playerId: number; playerName: string }[];
  validTargets: { playerId: number; playerName: string; isAlive: boolean }[];
  minTargets: number;
  maxTargets: number;
  canSkip: boolean;
}

export interface PresetInfo {
  id: number;
  name: string;
  createdBy: number;
  creatorName?: string;
  items: { roleId: number; roleKey: string; roleName: string; count: number }[];
  createdAt: string;
}

export interface NoteInfo {
  id: number;
  targetAccountId: number;
  targetName: string;
  content: string;
  updatedAt: string;
}

export interface ReplayData {
  game: GameInfo;
  roles: Array<{ roleId: number; roleName: string; faction: string; count: number }>;
  players: Array<{
    playerId: number;
    accountName: string;
    seatNumber: number;
    roleName: string;
    faction: string;
    isAlive: boolean;
  }>;
  distributionChart: Array<{ roleName: string; faction: string; count: number }>;
  nightLogs: Array<{
    roundNumber: number;
    actions: NightActionInfo[];
    dawnResults: DawnResultInfo[];
  }>;
  survivalTimeline: Array<{
    roundNumber: number;
    deaths: Array<{ playerName: string; causeOfDeath: string }>;
  }>;
}

// Socket.io 事件 payload 类型
export interface NightPromptPayload extends ModulePrompt {}

export interface DawnResultsPayload {
  nightRoundId: number;
  roundNumber: number;
  deaths: Array<{ playerId: number; playerName: string; causeOfDeath: string }>;
  announcements: Array<{ type: string; content: string }>;
}

export interface GameEndedPayload {
  gameId: number;
  roundNumber: number;
  winner: string;
  deaths: Array<{ playerId: number; playerName: string; causeOfDeath: string }>;
}

export interface IdentityAssignedPayload {
  roleId: number;
  roleName: string;
  roleKey: string;
  faction: string;
  skillDescription: string;
}
