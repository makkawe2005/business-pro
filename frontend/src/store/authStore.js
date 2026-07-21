import { create } from 'zustand';
import { usePermissionsStore } from './permissionsStore';
import { useMyTasksStore } from './myTasksStore';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('authUser') || 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('authToken'),
  user: readUser(),
  login(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('authUser', JSON.stringify(user));
    set({ token, user });
  },
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    set({ token: null, user: null });
    usePermissionsStore.getState().clear();
    useMyTasksStore.getState().clear();
  }
}));
