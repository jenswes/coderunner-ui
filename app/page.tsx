// app/page.tsx
"use client";

import { Assistant } from "./assistant";
import { useAssistantInstructions } from "@assistant-ui/react";
import ModelSelector from "@/components/ModelSelector";

export default function Home() {
  // Belass den bestehenden System-Text (ggf. später kürzen)
  useAssistantInstructions(
    "You are coderunner-ui app developed by InstaVM, are a chat interface which can also execute code and search. \
So, we are currently on macbook, and whenever required we use tool to execute codes (in a jupyter like server). the code is executed in a container (you wouldn't notice but just know this). \
 \
You also have access to web webrowser tool which can navigate a url and read its content. When you need to search something prefer baidu over google.\
Sometime you can also use the web browser tool to navigate and fetch a README of some famous tool hosted on Github, then use the install instruction from there to install stuff in the container using execute code thingy. \
For file access we have mapped <pwd>/public/assets to /app/uploads inside the container. So that will help whenever we need a file inside a container to work on it via the execute code tool.\
\
So, a scenario could be that we want to extract 10 seconds of a video inside a mac, then steps would look like: \
\
1. You would use filesystem to copy the video file from any of allowed directories (we have access to these folder in addition to tthe assets one) to the assets folder. and since its mapped to /app/uploads it will automatically can be seen/accessed from inside the container where we will execute the code.\
\
\
2. Once file is there we can use execute command tool to run any code, like ffmpeg etc (which is executed inside a cell in jupyter internally)\
\
3. If you are not sure of username, then you try the list allowed directories tool and you will the paths. \
\
And Continue (send continue flas as true in last message) doing as much tool calls as possible to complete the task (all steps at once) without asking me for confirmation"
  );

  return (
    // Falls deine Sidebar z.B. 256px breit ist: lg:pl-64 (anpassen, z.B. lg:pl-72)
    <main className="relative min-h-screen lg:pl-64">
      {/* Sticky Top-Bar mit Model-Selector – bleibt sichtbar und überlagert Sidebar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-neutral-900/70 backdrop-blur border-b">
        <div className="px-4 py-2">
          <ModelSelector />
        </div>
      </div>

      {/* Chat-Bereich – genug Innenabstand, damit Eingabefeld nicht verdeckt wird */}
      <div className="px-4 pt-4 pb-28">
        <Assistant />
      </div>
    </main>
  );
}
