import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { InletbaseClient } from '../client';
import { InletbaseConfig } from '../types';

const InletbaseContext = createContext<InletbaseClient | undefined>(undefined);

export interface InletbaseProviderProps extends InletbaseConfig {
  children: ReactNode;
}

export function InletbaseProvider({ apiKey, baseUrl, children }: InletbaseProviderProps) {
  const client = useMemo(() => new InletbaseClient({ apiKey, baseUrl }), [apiKey, baseUrl]);

  return (
    <InletbaseContext.Provider value={client}>
      {children}
    </InletbaseContext.Provider>
  );
}

export function useInletbaseClient(): InletbaseClient {
  const context = useContext(InletbaseContext);
  if (!context) {
    throw new Error('useInletbaseClient must be used within an InletbaseProvider');
  }
  return context;
}
