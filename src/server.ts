import { routeAgentRequest, type Schedule } from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
} from "ai";
import { processToolCalls } from "./utils";
import { tools, executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { createAnthropic } from "@ai-sdk/anthropic";

// import { env } from "cloudflare:workers";
export interface Env {
  AI: Ai;
  NpsMcpAgent: DurableObjectNamespace;
  NPS_API_KEY: string;
  RECGOV_API_KEY: string;
  WEATHER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
}


// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */
  private _anthropic?: ReturnType<typeof createAnthropic>;

  private getAnthropic() {
    if (!this._anthropic) {
      this._anthropic = createAnthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    }
    return this._anthropic;
  }
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    return agentContext.run(this, async () => {
      return createDataStreamResponse({
        execute: async (dataStream) => {
          // handle any pending tool interactions first
          const processed = await processToolCalls({
            messages: this.messages,
            dataStream,
            tools,
            executions,
          });

          // choose your Claude model ID
          const anthropic = this.getAnthropic();
          const model = anthropic("claude-3-5-haiku-20241022");
          // stream the response
          const result = streamText({
            model,
            system: `
You are a knowledgeable NPS guide.

${unstable_getSchedulePrompt({ date: new Date() })}`, // TODO: update this prompt
            messages: processed,
            tools,
            onFinish,
            onError: (err) => console.error("Stream error:", err),
            maxSteps: 10,
          });
          // merge AI tokens and tool outputs back to the client
          result.mergeIntoDataStream(dataStream);
        },
      });
    });
  }
  async executeTask(description: string, task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-anthropic-key") {
      const hasKey = !!process.env.ANTHROPIC_API_KEY;
      return Response.json({
        success: hasKey,
      });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "ANTHROPIC_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
