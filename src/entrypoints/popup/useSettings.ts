import { useCallback, useEffect, useState } from "react";
import { defaultSettings, loadSettings, saveSettings, type Settings } from "../../core/settings";

export function useSettings(): [Settings, (changes: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const update = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...changes };
      void saveSettings(next);
      return next;
    });
  }, []);

  return [settings, update];
}
