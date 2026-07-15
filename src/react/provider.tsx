import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { InletbaseFormClient } from '../client';
import { InletbaseConfig } from '../types';

const InletbaseContext = createContext<InletbaseFormClient | undefined>(undefined);

export interface InletbaseProviderProps extends InletbaseConfig {
  children: ReactNode;
}

export function InletbaseProvider({ apiKey, children }: InletbaseProviderProps) {
  const client = useMemo(() => new InletbaseFormClient({ apiKey }), [apiKey]);

  return (
    <InletbaseContext.Provider value={client}>
      {children}
    </InletbaseContext.Provider>
  );
}

export function useInletbaseFormClient(): InletbaseFormClient {
  const context = useContext(InletbaseContext);
  if (!context) {
    throw new Error('useInletbaseFormClient must be used within an InletbaseProvider');
  }
  return context;
}
