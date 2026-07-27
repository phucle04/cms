'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as Types from '@/lib/types';
import * as API from '@/lib/api';

interface AppContextType {
  // Settings
  settings: Types.AppSettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (data: Partial<Types.AppSettings>) => Promise<void>;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Loading and Error states
  isLoading: boolean;
  error: string | null;
  clearError: () => void;

  // Current selections
  currentModule: string;
  setCurrentModule: (module: string) => void;

  // Notification
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Types.AppSettings | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModule, setCurrentModule] = useState('dashboard');

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await API.SettingsAPI.get();
      setSettings(data);
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (data: Partial<Types.AppSettings>) => {
    try {
      setIsLoading(true);
      const updated = await API.SettingsAPI.update(data);
      setSettings(updated);
    } catch (err) {
      setError('Failed to update settings');
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    // Placeholder - can be extended with toast notifications
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  const value: AppContextType = {
    settings,
    loadSettings,
    updateSettings,
    sidebarOpen,
    setSidebarOpen,
    isLoading,
    error,
    clearError,
    currentModule,
    setCurrentModule,
    showNotification,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
