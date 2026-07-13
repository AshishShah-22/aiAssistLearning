'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import type { AuthUser } from '@/stores';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user && !cancelled) {
            setUser(data.user as AuthUser);
            return;
          }
        }
      } catch {
        // Network error — treat as logged out
      }
      if (!cancelled) setUser(null);
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return <>{children}</>;
}