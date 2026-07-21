import { create } from 'zustand';
import { apiFetch } from '../api/client';

export const useMyTasksStore = create((set) => ({
  hasTasks: false,
  loaded: false,
  async loadMyTasksCount() {
    try {
      const res = await apiFetch('/my-tasks/count');
      if (!res.ok) throw new Error('Failed to load task count');
      const { count } = await res.json();
      set({ hasTasks: count > 0, loaded: true });
    } catch (err) {
      console.error(err);
      set({ hasTasks: false, loaded: true });
    }
  },
  clear() {
    set({ hasTasks: false, loaded: false });
  }
}));
