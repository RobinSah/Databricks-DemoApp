import { NextRequest, NextResponse } from "next/server";

import { RENDER_CHART_ACTION } from "@/lib/chat-contract";
import { getLlmProvider } from "@/lib/llm";

/**
 * Deterministic OpenAI-compatible chat-completions endpoint used by the
 * Playwright suite (LLM_PROVIDER=mock). It scripts two behaviors:
 *
 *  1. A data question ("Show me GDP of India…") → emits a tool call to the
 *     renderIndicatorChart frontend action, exercising the full CopilotKit
 *     tool-call → chart-render loop.
 *  2. Anything else → streams a canned text reply.
 *
 * A follow-up request containing tool results gets a canned summary, closing
 * the loop the way a real model would. The endpoint is disabled (404) unless
 * the app is explicitly running in mock mode, so it never ships active.
 */

interface IncomingMessage {
  role: string;
  content?: string | null;
}

interface IncomingTool {
  type: string;
  function?: { name?: string };
}

interface MockRequestBody {
  messages?: IncomingMessage[];
  tools?: IncomingTool[];
}

const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\bindia\b/i, "IND"],
  [/\bunited states\b|\busa\b|\bamerica\b/i, "USA"],
  [/\bjapan\b/i, "JPN"],
  [/\bchina\b/i, "CHN"],
  [/\bbrazil\b/i, "BRA"],
  [/\bgermany\b/i, "DEU"],
  [/\bkenya\b/i, "KEN"],
  [/\bunited kingdom\b|\buk\b/i, "GBR"],
];

const INDICATOR_PATTERNS: [RegExp, string][] = [
  [/gdp per capita/i, "NY.GDP.PCAP.CD"],
  [/\bgdp\b/i, "NY.GDP.MKTP.CD"],
  [/population/i, "SP.POP.TOTL"],
  [/life expectancy/i, "SP.DYN.LE00.IN"],
  [/internet/i, "IT.NET.USER.ZS"],
  [/inflation/i, "FP.CPI.TOTL.ZG"],
  [/unemployment/i, "SL.UEM.TOTL.ZS"],
  [/co2|carbon|emissions/i, "EN.GHG.CO2.PC.CE.AR5"],
];

export async function POST(request: NextRequest): Promise<Response> {
  if (getLlmProvider() !== "mock") {
    return NextResponse.json({ error: "Mock LLM is disabled" }, { status: 404 });
  }

  const body = (await request.json()) as MockRequestBody;
  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hasToolResult = messages.some((m) => m.role === "tool");
  const chartToolOffered = (body.tools ?? []).some(
    (t) => t.function?.name === RENDER_CHART_ACTION,
  );

  if (hasToolResult) {
    return streamResponse(
      textChunks(
        "Here is the chart with real World Bank data. " +
          "The overall trend is clearly visible across the selected period. " +
          "(mock summary)",
      ),
    );
  }

  const prompt = typeof lastUser?.content === "string" ? lastUser.content : "";
  const indicator = INDICATOR_PATTERNS.find(([re]) => re.test(prompt))?.[1];

  if (indicator && chartToolOffered) {
    const countries = COUNTRY_PATTERNS.filter(([re]) => re.test(prompt)).map(([, code]) => code);
    const years = prompt.match(/\b(?:19|20)\d{2}\b/g)?.map(Number) ?? [];
    const args = {
      countries: countries.length > 0 ? countries : ["USA"],
      indicatorId: indicator,
      startYear: years[0] ?? 2000,
      endYear: years[1] ?? 2023,
    };
    return streamResponse(toolCallChunks(RENDER_CHART_ACTION, JSON.stringify(args)));
  }

  return streamResponse(
    textChunks(
      "Hello! I'm Atlas (running in mock mode). " +
        "Ask me about GDP, population, or life expectancy of any country.",
    ),
  );
}

/** Split text into word-level OpenAI chat.completion.chunk deltas. */
function textChunks(text: string): object[] {
  const words = text.split(" ");
  const chunks: object[] = words.map((word, i) =>
    chunk({ content: i === 0 ? word : ` ${word}` }, null),
  );
  chunks.push(chunk({}, "stop"));
  return chunks;
}

/** Emit a single function tool call, arguments split across two deltas. */
function toolCallChunks(name: string, args: string): object[] {
  const mid = Math.floor(args.length / 2);
  return [
    chunk(
      {
        tool_calls: [
          {
            index: 0,
            id: `call_mock_${Date.now()}`,
            type: "function",
            function: { name, arguments: args.slice(0, mid) },
          },
        ],
      },
      null,
    ),
    chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(mid) } }] }, null),
    chunk({}, "tool_calls"),
  ];
}

function chunk(delta: object, finishReason: string | null): object {
  return {
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "mock-model",
    choices: [{ index: 0, delta: { role: "assistant", ...delta }, finish_reason: finishReason }],
  };
}

function streamResponse(chunks: object[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(c)}\n\n`));
        // Small delay so the UI visibly streams, as a real model would.
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
