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
  "ollama/qwen3": "Qwen 3",
  "anthropic/claude-sonnet-4-20250514": "Claude 4 Sonnet",
  "openai/gpt-4.1-mini": "GPT 4o",
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