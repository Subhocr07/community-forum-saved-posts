'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type PersonaId = 'alice' | 'bob' | 'charlie' | 'mallory' | 'unauthenticated';

export interface Persona {
  id: PersonaId;
  name: string;
  role: 'student' | 'moderator' | 'none';
  description: string;
}

export const personas: Record<PersonaId, Persona> = {
  alice: { id: 'alice', name: 'Alice', role: 'student', description: 'Student (Math)' },
  bob: { id: 'bob', name: 'Bob', role: 'student', description: 'Student (Physics)' },
  charlie: { id: 'charlie', name: 'Charlie', role: 'student', description: 'Student (Math & Physics)' },
  mallory: { id: 'mallory', name: 'Mallory', role: 'moderator', description: 'Moderator' },
  unauthenticated: { id: 'unauthenticated', name: 'Guest', role: 'none', description: 'Unauthenticated' },
};

interface PersonaContextType {
  activePersona: Persona;
  setActivePersona: (id: PersonaId) => void;
  getHeaders: () => Record<string, string>;
}

const PersonaContext = createContext<PersonaContextType | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [activePersona, setActivePersonaState] = useState<Persona>(personas.alice);

  const setActivePersona = (id: PersonaId) => {
    setActivePersonaState(personas[id]);
  };

  const getHeaders = (): Record<string, string> => {
    if (activePersona.id === 'unauthenticated') {
      return {};
    }
    return {
      'x-user-id': activePersona.id,
      'x-role': activePersona.role,
    };
  };

  return (
    <PersonaContext.Provider value={{ activePersona, setActivePersona, getHeaders }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}
