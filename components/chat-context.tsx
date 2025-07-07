"use client";
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ChatContextType = {
  model: string;
  apiKey: string;
  setModel: (model: string) => void;
  setApiKey: (key: string) => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [model, setModel] = useState("google_genai/gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  return (
    <ChatContext.Provider value={{ model, apiKey, setModel, setApiKey }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};