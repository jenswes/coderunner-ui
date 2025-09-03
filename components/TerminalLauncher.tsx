// components/TerminalLauncher.tsx
"use client";

export default function TerminalLauncher() {
  const open = () => {
    const name = "coderunner-terminal";
    const feat = [
      "popup=yes",
      "noopener",
      "noreferrer",
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "scrollbars=no",
      "resizable=yes",
      "width=1100",
      "height=700",
    ].join(",");
    window.open("/terminal", name, feat);
  };

  return (
    <button
      onClick={open}
      title="Open Terminal"
      className="fixed right-4 bottom-4 z-[1000] rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 px-4 h-11 flex items-center gap-2"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        className="-ml-1"
      >
        <path
          d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="m7 9 3 3-3 3" stroke="currentColor" strokeWidth="2" />
        <path d="M12 15h5" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="text-sm font-medium">Terminal</span>
    </button>
  );
}

