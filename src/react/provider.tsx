import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { ByteonicClient } from '../client';
import { ByteonicConfig } from '../types';

const ByteonicContext = createContext<ByteonicClient | undefined>(undefined);

export interface ByteonicProviderProps extends ByteonicConfig {
  children: ReactNode;
}

export function ByteonicProvider({ apiKey, baseUrl, children }: ByteonicProviderProps) {
  const client = useMemo(() => new ByteonicClient({ apiKey, baseUrl }), [apiKey, baseUrl]);

  return (
    <ByteonicContext.Provider value={client}>
      {children}
    </ByteonicContext.Provider>
  );
}

export function useByteonicClient(): ByteonicClient {
  const context = useContext(ByteonicContext);
  if (!context) {
    throw new Error('useByteonicClient must be used within a ByteonicProvider');
  }
  return context;
}
