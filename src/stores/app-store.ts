import { create } from 'zustand';

export type TabId = 'execution' | 'setup' | 'dashboard' | 'journal' | 'distribution' | 'timing' | 'videos' | 'notes' | 'news' | 'coach' | 'admin' | 'roles';

interface AppState {
  // Auth
  user: { id: string; email: string; name: string; role: string; language: string } | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authStatus: 'idle' | 'pending' | 'rejected';
  
  // Navigation
  activeTab: TabId;
  
  // Language
  language: 'fr' | 'en';
  
  // Trade form
  showTradeForm: boolean;
  editingTradeId: string | null;
  
  // Trade detail
  selectedTradeId: string | null;
  showTradeDetail: boolean;
  
  // Screenshot viewer
  screenshotViewerUrl: string | null;
  
  // Actions
  setUser: (user: AppState['user']) => void;
  setAuthLoading: (loading: boolean) => void;
  setAuthStatus: (status: AppState['authStatus']) => void;
  setActiveTab: (tab: TabId) => void;
  setLanguage: (lang: 'fr' | 'en') => void;
  setShowTradeForm: (show: boolean) => void;
  setEditingTradeId: (id: string | null) => void;
  setSelectedTradeId: (id: string | null) => void;
  setShowTradeDetail: (show: boolean) => void;
  setScreenshotViewerUrl: (url: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  authLoading: true,
  authStatus: 'idle',
  activeTab: 'execution',
  language: 'fr',
  showTradeForm: false,
  editingTradeId: null,
  selectedTradeId: null,
  showTradeDetail: false,
  screenshotViewerUrl: null,
  
  setUser: (user) => set({ user, isAuthenticated: !!user, authLoading: false, language: user?.language === 'en' ? 'en' : 'fr' }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setAuthStatus: (authStatus) => set({ authStatus }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLanguage: (language) => set({ language }),
  setShowTradeForm: (showTradeForm) => set({ showTradeForm }),
  setEditingTradeId: (editingTradeId) => set({ editingTradeId }),
  setSelectedTradeId: (selectedTradeId) => set({ selectedTradeId }),
  setShowTradeDetail: (showTradeDetail) => set({ showTradeDetail }),
  setScreenshotViewerUrl: (screenshotViewerUrl) => set({ screenshotViewerUrl }),
  logout: () => set({ user: null, isAuthenticated: false, authLoading: false, activeTab: 'execution' }),
}));
