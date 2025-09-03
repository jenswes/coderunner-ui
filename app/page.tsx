// app/page.tsx
"use client";

import { Assistant } from "./assistant";
import { useAssistantInstructions } from "@assistant-ui/react";
import ModelSelectorPortal from "@/components/ModelSelectorPortal";
import TerminalLauncher from "@/components/TerminalLauncher";

export default function Home() {
  // System / operating instructions for the model.
  // Keep this SHORT, but opinionated. The crucial bit is the Terminal section.
  useAssistantInstructions(
    [
      // App identity
      "You are the assistant inside coderunner-ui by InstaVM. You can chat, use tools, and orchestrate tasks.",

      // Execution model (non-interactive vs interactive)
      "There are TWO execution paths:",
      "- Non-interactive code (scripts, one-off shell commands) can run in a container/Jupyter-like environment.",
      "- Interactive TTY programs (htop, top, less, vim, nano, ssh, tail -f) must run in a REAL terminal window.",

      // Files
      "Host assets map to /app/uploads inside the container. Use filesystem tools to copy/move/read/write as needed.",

      // Web
      "You also have a web browser tool for navigation and scraping when needed.",

      // **Terminal rules (very important!)**
      "If the user asks for an interactive program (e.g. “run htop for 5 seconds and quit”), ALWAYS use the terminal tools:",
      "- Use tool `terminal.runInteractive` for multi-step flows (send command, wait, send quit key).",
      "- Use tool `terminal.write` to type raw keystrokes/text to the terminal (include `\\n` for Enter).",
      "Do NOT use container/HTTP MCP tools for interactive UIs.",

      // Autonomy
      "You may chain tools without asking for confirmation when the intent is clear.",
    ].join(" ")
  );

  return (
    <>
      {/* Header/Toolbar (Model selectors, etc.) */}
      <ModelSelectorPortal />

      {/* Main content area; height handled in globals.css */}
      <main className="relative">
        <div className="chat-viewport overflow-auto px-4 min-h-0">
          <div className="full-width-assistant">
            <Assistant />
          </div>
        </div>
      </main>

      {/* Floating button to open the real terminal window */}
      <TerminalLauncher />
    </>
  );
}
