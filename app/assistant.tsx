"use client";

import { useChatContext } from "@/components/chat-context";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SelectModel } from "@/components/model-select";
import { ApiKeyInput } from "@/components/api-key-input";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ModelOptions } from "@/types";

export const Assistant = () => {
//   const runtime = useChatRuntime({
//     api: "/api/chat",
//   });
     const { model, setModel, apiKey, setApiKey } = useChatContext();
     const isOllamaModel = model?.startsWith("ollama")
  return (
    // <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Coderunner
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    Chat
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <SelectModel onValueChange={setModel} value={model as ModelOptions} />

            <ApiKeyInput initialValue={apiKey} onSave={setApiKey} disabled={isOllamaModel}/>

          </header>
          <Thread />
        </SidebarInset>
      </SidebarProvider>
    // </AssistantRuntimeProvider>
  );
};

