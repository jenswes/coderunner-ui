import React, { useState, memo } from "react";
import { Input } from "./ui/input";

type ApiKeyInputProps = {
  placeholder?: string;
  onApiKeyChange?: (apiKey: string) => void;
};

export const ApiKeyInputComponent = ({
  placeholder = "Enter your API Key",
  onApiKeyChange,
}: ApiKeyInputProps): React.ReactElement => {
  const [apiKey, setApiKey] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    if (onApiKeyChange) {
      onApiKeyChange(newApiKey);
    }
  };

  return (
    <Input
      className="w-[260px]"
      value={apiKey}
      onChange={handleChange}
      placeholder={placeholder}
      type="password"
    />
  );
};

export const ApiKeyInput = memo(ApiKeyInputComponent);