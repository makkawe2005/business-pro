import { create } from 'zustand';
import { apiFetch } from '../api/client';

export const usePermissionsStore = create((set) => ({
  pageKeys: [],
  loaded: false,
  async loadPermissions() {
    try {
      const res = await apiFetch('/permissions/me');
      if (!res.ok) throw new Error('Failed to load permissions');
      const pageKeys = await res.json();
      set({ pageKeys, loaded: true });
    } catch (err) {
      console.error(err);
      set({ pageKeys: [], loaded: true });
    }
  },
  clear() {
    set({ pageKeys: [], loaded: false });
  }
}));
