import { create } from "zustand";
import { getFingerprint } from "../utils/deviceFingerprint";
import { api } from "../api/client";

interface DeviceStore {
  fingerprint: string;
  bindings: Array<{ accountId: number; accountName: string }>;
  loading: boolean;
  registerDevice: () => Promise<void>;
  fetchBindings: () => Promise<void>;
  bindAccount: (accountId: number) => Promise<any>;
  transferBinding: (accountId: number) => Promise<any>;
  unbindAccount: (accountId: number) => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  fingerprint: getFingerprint(),
  bindings: [],
  loading: false,

  registerDevice: async () => {
    try {
      await api.post("/device/register", {
        deviceFingerprint: get().fingerprint,
      });
    } catch (_) {
      // 幂等，忽略错误
    }
  },

  fetchBindings: async () => {
    try {
      const data = await api.get<{
        ok: boolean;
        bindings: Array<{ accountId: number; accountName: string }>;
      }>("/device/bindings");
      set({ bindings: data.bindings });
    } catch (_) {
      set({ bindings: [] });
    }
  },

  bindAccount: async (accountId: number) => {
    const data = await api.post("/device/bind", { accountId });
    await get().fetchBindings();
    return data;
  },

  transferBinding: async (accountId: number) => {
    const data = await api.post("/device/transfer", { accountId, confirm: true });
    await get().fetchBindings();
    return data;
  },

  unbindAccount: async (accountId: number) => {
    await api.post("/device/unbind", { accountId });
    await get().fetchBindings();
  },
}));
