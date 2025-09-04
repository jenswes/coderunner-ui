// app/page.tsx
"use client";

import { Assistant } from "./assistant";
import { useAssistantInstructions } from "@assistant-ui/react";
import ModelSelectorPortal from "@/components/ModelSelectorPortal";
import TerminalLauncher from "@/components/TerminalLauncher";

export default function Home() {
  // Focus the model on *real TTY* control only.
  useAssistantInstructions(
    [
      "You are the local coderunner-ui assistant.",
      "You have a REAL interactive terminal (PTY) available, opened by the user via the Terminal button.",
      "",
      "TOOLS YOU MAY USE:",
      "- terminal.playlist: Run a whole sequence serially in ONE call (preferred).",
      "- terminal.runInteractive: Start one interactive app for N ms, then quit.",
      "- terminal.write: Type raw keys (append '\\n' for Enter).",
      "- terminal.cancel: Send Ctrl-C to stop a hanging app.",
      "",
      "IMPORTANT RULES:",
      "1) Prefer terminal.playlist to avoid duplicate or overlapping runs.",
      "   - Example playlist (one call):",
      "     steps:",
      "       - write: 'apt-get update\\n'",
      "       - write: 'clear\\n'",
      "       - write: \"figlet 'Coderunner TTY' | /usr/games/lolcat\\n\"",
      "       - interactive: command 'htop', duration 5000 ms, quit 'q'",
      "       - interactive: command 'btop --utf-force', duration 5000 ms, quit 'q'",
      "       - interactive: command 'cmatrix -u 3', duration 3000 ms, quit 'ctrl-c'",
      "       - write: 'echo \"Coderunner loves real PTYs!\" | boxes -d peek | /usr/games/lolcat\\n'",
      "",
      "2) If an interactive run is already busy, either wait for it to end or use terminal.cancel or force:true in the next call.",
      "3) NEVER call container.exec or any other non-PTY execution path.",
      "4) When you want to run a single interactive tool briefly (e.g., 'htop 5 seconds'), use terminal.runInteractive with 'q' or 'ctrl-c' as quit.",
      "5) For simple commands, use terminal.write and remember to include '\\n' for Enter.",
      "",
      "BEHAVIORAL HINTS:",
      "- Do not repeat commands if they already ran successfully.",
      "- Avoid sending stray 'q' to non-interactive commands.",
      "- When unsure, explain what you’re about to do and then use terminal.playlist.",
    ].join(" ")
  );

  return (
    <>
      {/* Header/Toolbar: model selector (unchanged) */}
      <ModelSelectorPortal />

      {/* Main content: chat UI */}
      <main className="relative">
        <div className="chat-viewport overflow-auto px-4 min-h-0">
          <div className="full-width-assistant">
            <Assistant />
          </div>
        </div>
      </main>

      {/* Floating terminal button (opens real PTY in a separate window) */}
      <TerminalLauncher />
    </>
  );
}
