
"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import { Spinner } from "../ui/spinner";

type WeatherArgs = {
  location: string;
  unit: "celsius" | "fahrenheit";
};

type WeatherResult = {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  content?: { text: string }[];
};


export const WeatherToolUI = makeAssistantToolUI<WeatherArgs, WeatherResult>({
  toolName: "execute_python_code",
  render: ({ args, status, result }) => {
    if (status.type === "running") {
      return (
        <div className="flex items-center gap-2">
          <Spinner  />
          <span>Executing code in an isolated VM...</span>
        </div>
      );
    }

    if (status.type === "incomplete" && status.reason === "error") {
      return (
        <div className="text-red-500">
          Failed to execute code {args.location}
        </div>
      );
    }

    return (
      <div className="weather-card rounded-lg bg-blue-50 p-4">
        <h3 className="text-lg font-bold">blr</h3>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl">
              {result && result.content && result.content[0].text}
            </p>
            {/* <div className="text-gray-600"><p>descr:</p>
    {renderNestedObject(result)}</div> */}
          </div>
          <div className="text-sm">
            <p>Humidity: hola %</p>
            <p>Wind: hola km/h</p>
          </div>
        </div>
      </div>
    );
  },
});

