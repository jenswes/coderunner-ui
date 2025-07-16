import React, { useState, memo, useEffect } from "react";
import { Input } from "./ui/input";

type ApiKeyInputProps = {
  placeholder?: string;
  initialValue?: string;
  onSave: (apiKey: string) => void;
  disabled?: boolean;
};

export const ApiKeyInputComponent = ({
  placeholder = "Enter your API Key",
  initialValue = "",
  onSave,
  disabled = false,
}: ApiKeyInputProps) => {
  const [draftKey, setDraftKey] = useState(initialValue);

  // keep input in sync if initialValue changes
  useEffect(() => {
    setDraftKey(initialValue);
  }, [initialValue]);

    const [showSaved, setShowSaved] = useState(false);

    const handleSave = () => {
    onSave(draftKey);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
    };

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-[260px]"
        value={draftKey}
        onChange={(e) => setDraftKey(e.target.value)}
        placeholder={placeholder}
        type="password"
        disabled={disabled}
      />
      <button
      onClick={handleSave}
      disabled={disabled}
      className={`px-3 py-1 rounded transition ${disabled ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 text-white"}`}

    >
      Save
    </button>
    {showSaved && (
      <span className="ml-2 text-green-500 saved-badge">
        Saved!
      </span>
    )}
    </div>
  );
};

export const ApiKeyInput = memo(ApiKeyInputComponent);