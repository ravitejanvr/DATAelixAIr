import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface ConsentContextType {
  consent: ConsentPreferences | null;
  hasResponded: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  updatePreferences: (prefs: Partial<ConsentPreferences>) => void;
  reopenBanner: () => void;
  showBanner: boolean;
}

const STORAGE_KEY = "cookie_consent_v1";

const ConsentContext = createContext<ConsentContextType | null>(null);

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentPreferences | null>(null);
  const [hasResponded, setHasResponded] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConsent(JSON.parse(stored));
        setHasResponded(true);
      } else {
        setShowBanner(true);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  const save = useCallback((prefs: ConsentPreferences) => {
    setConsent(prefs);
    setHasResponded(true);
    setShowBanner(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, []);

  const acceptAll = useCallback(() => save({ essential: true, analytics: true, marketing: true }), [save]);
  const rejectAll = useCallback(() => save({ essential: true, analytics: false, marketing: false }), [save]);
  const updatePreferences = useCallback((prefs: Partial<ConsentPreferences>) => {
    const merged = { essential: true, analytics: false, marketing: false, ...consent, ...prefs };
    merged.essential = true;
    save(merged);
  }, [consent, save]);
  const reopenBanner = useCallback(() => setShowBanner(true), []);

  return (
    <ConsentContext.Provider value={{ consent, hasResponded, acceptAll, rejectAll, updatePreferences, reopenBanner, showBanner }}>
      {children}
    </ConsentContext.Provider>
  );
}
