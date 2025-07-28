import React from "react";
import { ModelOptions } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const modelOptionsAndLabels: Partial<Record<ModelOptions, string>> = {
  "ollama/llama3.1:8b": "Llama 3.1 8B",
  "ollama/llama4:latest": "Llama 4 Latest",
  "ollama/qwen3": "Qwen 3",
  "ollama/qwen3:32b": "Qwen 3 32B",
  "anthropic/claude-sonnet-4-20250514": "Claude Sonnet 4",
  "anthropic/claude-3-7-sonnet-latest": "Claude 3.7 Sonnet Latest",
  "anthropic/claude-3-5-haiku-latest": "Claude 3.5 Haiku Latest",
  "anthropic/claude-opus-4-20250514": "Claude Opus 4",
  "openai/gpt-4o": "GPT 4o",
  "openai/gpt-4.1": "GPT 4.1",
  "openai/gpt-4.1-mini": "GPT 4.1 Mini",
  "o4-mini": "o4-mini",
  "google_genai/gemini-2.5-pro": "Gemini 2.5 Pro",
  "google_genai/gemini-2.5-flash": "Gemini 2.5 Flash",
};

type SelectModelProps = {
  value: ModelOptions;
  onValueChange: (model: ModelOptions) => void;
};

export const SelectModelComponent = ({
  value,
  onValueChange,
}: SelectModelProps): React.ReactElement => (
  <Select onValueChange={(v) => onValueChange(v as ModelOptions)} value={value}>
    <SelectTrigger className="w-[180px] ">
      <SelectValue placeholder="Model" />
    </SelectTrigger>
    <SelectContent className="bg-[#1a1a1a] text-white">
      {Object.entries(modelOptionsAndLabels).map(([model, label]) => (
        <SelectItem className="hover:bg-[#2b2b2b]" key={model} value={model}>
          {label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const SelectModel = React.memo(SelectModelComponent);