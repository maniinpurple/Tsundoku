import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { defaultSettings, loadSettings, saveSettings, type Settings } from "../../core/settings";
import { applyTheme } from "./theme";

export function useSettings(): [Settings, (changes: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    void loadSettings().then(setSettings);
    // Keeps several components (header, Settings tab) in sync. Only reacts to the settings key itself.
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === "local" && changes.settings?.newValue) {
        setSettings({ ...defaultSettings, ...(changes.settings.newValue as Partial<Settings>) });
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  const update = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...changes };
      void saveSettings(next);
      return next;
    });
  }, []);

  return [settings, update];
}
