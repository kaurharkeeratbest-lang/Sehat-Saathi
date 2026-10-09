// Lightweight app state: device key + language + onboarding flag.
import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyRTL } from "./i18n";
import { api } from "./api";

type State = {
  deviceKey: string;
  language: string;
  onboarded: boolean;
  voiceEnabled: boolean;
  setLanguage: (l: string) => Promise<void>;
  setVoiceEnabled: (v: boolean) => Promise<void>;
  setOnboarded: (v: boolean) => Promise<void>;
};

const Ctx = createContext<State | null>(null);

function uuid() {
  return "xxxxxxxxyxxxxxxxxyxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [deviceKey, setDeviceKey] = useState("");
  const [language, setLanguageState] = useState("hi");
  const [onboarded, setOnboardedState] = useState(false);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      let dk = await AsyncStorage.getItem("deviceKey");
      if (!dk) {
        dk = uuid();
        await AsyncStorage.setItem("deviceKey", dk);
      }
      const lang = (await AsyncStorage.getItem("language")) || "hi";
      const ob = (await AsyncStorage.getItem("onboarded")) === "1";
      const ve = (await AsyncStorage.getItem("voiceEnabled")) !== "0";
      setDeviceKey(dk);
      setLanguageState(lang);
      setOnboardedState(ob);
      setVoiceEnabledState(ve);
      applyRTL(lang);
      setReady(true);
      try {
        await api.upsertProfile({ device_key: dk, language: lang, voice_enabled: ve });
      } catch {}
    })();
  }, []);

  const setLanguage = async (l: string) => {
    setLanguageState(l);
    await AsyncStorage.setItem("language", l);
    applyRTL(l);
    try { await api.upsertProfile({ device_key: deviceKey, language: l, voice_enabled: voiceEnabled }); } catch {}
  };
  const setVoiceEnabled = async (v: boolean) => {
    setVoiceEnabledState(v);
    await AsyncStorage.setItem("voiceEnabled", v ? "1" : "0");
    try { await api.upsertProfile({ device_key: deviceKey, language, voice_enabled: v }); } catch {}
  };
  const setOnboarded = async (v: boolean) => {
    setOnboardedState(v);
    await AsyncStorage.setItem("onboarded", v ? "1" : "0");
  };

  if (!ready) return null;
  return (
    <Ctx.Provider value={{ deviceKey, language, onboarded, voiceEnabled, setLanguage, setVoiceEnabled, setOnboarded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppState not ready");
  return v;
}
