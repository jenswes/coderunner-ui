
"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Spinner } from "../ui/spinner";

type CodeExecutionArgs = { command: string };
type CodeExecutionResult = { content?: { text: string }[] };

export const CodeExecutionToolUI = makeAssistantToolUI<CodeExecutionArgs, CodeExecutionResult>({
  toolName: "execute_python_code",
  render: ({ args, status, result }) => {
    // running
    if (status.type === "running") {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Spinner />
          <span className="text-sm">Running code in VM…</span>
        </div>
      );
    }

    // error
    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
          <strong>Execution failed:</strong>
          <div className="mt-1">{status.error?.message || "Unknown error"}</div>
        </div>
      );
    }

    // success
    if (status.type === "complete" && result) {
      const inputCode = args.command;
      const outputText = result.content?.map(c => c.text).join("") || "";
      // extract any /Users/...mp4|webm|ogg path
      const pathRegex = /\/Users\/\S+\.(mp4|webm|ogg)/i;
      const match = outputText.match(pathRegex);
      const videoPath = match?.[0];
      const hasVideo = Boolean(videoPath);
      return (
        <div className="space-y-6">
          <div>
            <div className="font-bold mb-1 text-green-700">▶ Code:</div>
            <pre className="
              bg-gradient-to-r from-green-50 to-green-100
              p-3 rounded-lg border-l-4 border-green-400
              font-mono text-sm transition-shadow hover:shadow-lg
              overflow-auto
            ">
              {inputCode}
            </pre>
          </div>
          <div>
            <div className="font-bold mb-1 text-purple-700">🖥️ Output:</div>
            {hasVideo ? (
              <>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-auto drop-shadow">
                  {outputText}
                </pre>
                <video
                  src={videoPath}
                  controls
                  className="w-full rounded-lg border bg-black"
                />
              </>
            ) : (
              <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-auto drop-shadow">
                {outputText}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return null;
  },
});