"use client";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ModelOptions } from "../types";

export type ChatContextType = {
  model: string;
  apiKey: string;
  setModel: (model: ModelOptions) => void;
  setApiKey: (key: string) => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);



export const ChatProvider = ({ children }) => {
  const [model, _setModel] = useState<ModelOptions>("openai/gpt-4.1-mini");
  const [apiKey, _setApiKey] = useState<string>("");

  // on mount: load saved settings
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chatSettings") || "{}");
    if (stored.model) _setModel(stored.model);
    const keys = stored.apiKeysByProvider || {};
    if (stored.model && keys[stored.model]) {
      _setApiKey(keys[stored.model]);
    }
  }, []);

  // save whenever model changes
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("chatSettings") || "{}");
    const keys = stored.apiKeysByProvider || {};
    localStorage.setItem(
      "chatSettings",
      JSON.stringify({
        ...stored,
        model,
        apiKeysByProvider: keys
      })
    );
  }, [model]);

  // wrapper that updates state + persists this provider’s key
  const setApiKey = (key: string) => {
    _setApiKey(key);
    const stored = JSON.parse(localStorage.getItem("chatSettings") || "{}");
    const keys = stored.apiKeysByProvider || {};
    keys[model] = key;
    localStorage.setItem(
      "chatSettings",
      JSON.stringify({ ...stored, apiKeysByProvider: keys })
    );
  };

  const setModel = (m: ModelOptions) => {
  _setModel(m);

  // load any saved key for the newly selected model
  const stored = JSON.parse(localStorage.getItem("chatSettings") || "{}");
  const keys = stored.apiKeysByProvider || {};
  _setApiKey(keys[m] || "");
};

  return (
    <ChatContext.Provider value={{ model, setModel, apiKey, setApiKey }}>
      {children}
    </ChatContext.Provider>
  );
}
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};