"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Spinner } from "../ui/spinner";

type CodeExecutionArgs = { command: string };
// --- CORRECTED: Reverting to your original, correct data structure ---
type CodeExecutionResult = { content?: { text: string }[] };

// Reusable component to display the input code block
const CodeInputDisplay = ({ command }: { command: string }) => (
  <div>
    <div className="font-bold mb-1 text-gray-700">▶ Executing Code:</div>
    <pre className="
      bg-gray-100
      p-3 rounded-lg border-l-4 border-gray-400
      font-mono text-sm
      overflow-auto
    ">
      {command}
    </pre>
  </div>
);

// This component is fine, as it expects a string prop. The error was in what we passed to it.
const OutputDisplay = ({ outputText }: { outputText: string }) => {
    const pathRegex = /\/Users\/\S+\.(mp4|webm|ogg)/i;
    // We now ensure outputText is a string before this component is called
    const match = outputText.match(pathRegex);
    const videoPath = match?.[0];

    return (
      <div>
        <div className="font-bold mb-1 text-purple-700">🖥️ Output:</div>
        {videoPath ? (
          <div className="space-y-2">
            <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-auto drop-shadow">
              {outputText}
            </pre>
            <video
              src={videoPath}
              controls
              className="w-full rounded-lg border bg-black"
            />
          </div>
        ) : (
          <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-auto drop-shadow">
            {outputText || "[No output yet...]"}
          </pre>
        )}
      </div>
    );
};


export const CodeExecutionToolUI = makeAssistantToolUI<CodeExecutionArgs, CodeExecutionResult>({
  toolName: "execute_python_code",
  render: ({ args, status, result }) => {
    // --- RUNNING STATE ---
    if (status.type === "running") {
      // Use your original logic to process partial results during streaming.
      // This ensures `partialText` is a string.
      const partialText = result?.content?.map(c => c.text).join("") || "";

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Spinner />
            <span className="text-sm">Running code in VM…</span>
          </div>
          {/* Show the input code immediately */}
          <CodeInputDisplay command={args.command} />

          {/* Show partial output only if it exists */}
          {partialText && (
            <OutputDisplay outputText={partialText} />
          )}
        </div>
      );
    }

    // --- ERROR STATE ---
    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="space-y-4">
            <CodeInputDisplay command={args.command} />
            <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
            <strong>Execution failed:</strong>
            <div className="mt-1">{status.error?.message || "Unknown error"}</div>
            </div>
        </div>
      );
    }

    // --- COMPLETE STATE ---
    if (status.type === "complete" && result) {
      // --- CORRECTED: Use your original logic to get the final output string ---
      const outputText = result.content?.map(c => c.text).join("") || "";

      return (
        <div className="space-y-4">
          <CodeInputDisplay command={args.command} />
          <OutputDisplay outputText={outputText} />
        </div>
      );
    }

    return null;
  },
});