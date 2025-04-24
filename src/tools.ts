/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool } from "ai";
import { z } from "zod";

import { agentContext } from "./server";
import {
  unstable_scheduleSchema,
} from "agents/schedule";

// Define types for MCP responses
interface McpToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

interface McpMetadata {
  name: string;
  version: string;
  tools: Array<{
    name: string;
    description: string;
  }>;
}

// Get MCP URL from environment or use localhost as fallback
// For Cloudflare, this would typically be an environment variable
const getMcpBaseUrl = () => {
  // In production (Cloudflare), this would come from environment variables
  if (typeof process !== 'undefined' && process.env && process.env.MCP_URL) {
    return process.env.MCP_URL;
  }

  // If running in browser, check for window.__ENV__.MCP_URL
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.MCP_URL) {
    return window.__ENV__.MCP_URL;
  }

  // Default for local development
  return "http://localhost:5173/mcp";
};

// Basic MCP client using fetch with proper types
const mcpClient = {
  // Call a tool on the MCP server
  callTool: async (toolName: string, params: any): Promise<McpToolResponse> => {
    try {
      const response = await fetch(`${getMcpBaseUrl()}/tools/${toolName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json() as McpToolResponse;
    } catch (error) {
      console.error(`Error calling MCP tool ${toolName}:`, error);
      throw error;
    }
  },

  // Get metadata about the MCP server
  getMetadata: async (): Promise<McpMetadata> => {
    try {
      const response = await fetch(`${getMcpBaseUrl()}/metadata`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json() as McpMetadata;
    } catch (error) {
      console.error("Error getting MCP metadata:", error);
      throw error;
    }
  }
};

// Fix TypeScript global declaration for browser environment
declare global {
  interface Window {
    __ENV__?: {
      MCP_URL?: string;
    };
  }
}

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 * The actual implementation is in the executions object below
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  parameters: z.object({ city: z.string() }),
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

// Updated Park Information tool that uses MCP
const getParkInfo = tool({
  description: "Get detailed information about a national park",
  parameters: z.object({
    parkCode: z.string().describe("The park code (e.g., 'yose' for Yosemite, 'grca' for Grand Canyon)"),
  }),
  execute: async ({ parkCode }) => {
    try {
      // Call MCP tool directly
      const response = await mcpClient.callTool("getParkOverview", {
        parkCode: parkCode
      });

      return response.content[0].text;
    } catch (error: any) {
      console.error("Error calling MCP server:", error);
      return `Error retrieving information for park code ${parkCode}: ${error.message}`;
    }
  }
});

// New tool to search parks by state
const searchParksByState = tool({
  description: "Search for national parks in a specific state",
  parameters: z.object({
    stateCode: z.string().describe("Two-letter state code (e.g., CA, NY)")
  }),
  execute: async ({ stateCode }) => {
    try {
      const response = await mcpClient.callTool("searchParksByState", {
        stateCode: stateCode
      });

      return response.content[0].text;
    } catch (error: any) {
      console.error("Error searching parks by state:", error);
      return `Error searching for parks in ${stateCode}: ${error.message}`;
    }
  }
});

// New tool to get park weather forecast
const getParkWeatherForecast = tool({
  description: "Get detailed weather forecast for a national park",
  parameters: z.object({
    parkCode: z.string().describe("The park code (e.g., 'yose' for Yosemite, 'grca' for Grand Canyon)"),
  }),
  execute: async ({ parkCode }) => {
    try {
      const response = await mcpClient.callTool("getParkWeatherForecast", {
        parkCode: parkCode
      });

      return response.content[0].text;
    } catch (error: any) {
      console.error("Error getting park weather forecast:", error);
      return `Error retrieving weather forecast for ${parkCode}: ${error.message}`;
    }
  }
});

// New tool to plan a park visit based on weather
const planParkVisit = tool({
  description: "Get recommendations for the best time to visit a park based on weather",
  parameters: z.object({
    parkCode: z.string().describe("The park code (e.g., 'yose' for Yosemite)"),
    startDate: z.string().optional().describe("Start date of your trip (YYYY-MM-DD)"),
    endDate: z.string().optional().describe("End date of your trip (YYYY-MM-DD)")
  }),
  execute: async ({ parkCode, startDate, endDate }) => {
    try {
      const response = await mcpClient.callTool("planParkVisit", {
        parkCode,
        startDate,
        endDate
      });

      return response.content[0].text;
    } catch (error: any) {
      console.error("Error planning park visit:", error);
      return `Error planning visit to ${parkCode}: ${error.message}`;
    }
  }
});

// New tool to find recreation areas near a location
const findNearbyRecreation = tool({
  description: "Find recreation areas and camping options near a location",
  parameters: z.object({
    location: z.string().describe("Location name or coordinates"),
    distance: z.number().optional().describe("Search radius in miles"),
    activityType: z.string().optional().describe("Type of activity (e.g., 'camping', 'hiking')")
  }),
  execute: async ({ location, distance, activityType }) => {
    try {
      const response = await mcpClient.callTool("findNearbyRecreation", {
        location,
        distance: distance || 50,
        activityType
      });

      return response.content[0].text;
    } catch (error: any) {
      console.error("Error finding nearby recreation:", error);
      return `Error finding recreation near ${location}: ${error.message}`;
    }
  }
});

// New diagnostic tool to check MCP server status
const checkMcpStatus = tool({
  description: "Check the status of the MCP server and its available tools",
  parameters: z.object({}),
  execute: async () => {
    try {
      // Get server metadata
      const metadata = await mcpClient.getMetadata();

      // List available tools
      const tools = metadata.tools || [];
      const toolNames = tools.map(t => t.name);

      return `MCP Server Status:
      
Server name: ${metadata.name}
Server version: ${metadata.version}
MCP URL: ${getMcpBaseUrl()}
Available tools (${toolNames.length}): ${toolNames.join(', ')}
Connection status: Connected
`;
    } catch (error: any) {
      console.error("Error checking MCP status:", error);
      return `Error connecting to MCP server: ${error.message}. Please check that the server is running at ${getMcpBaseUrl()}.`;
    }
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  parameters: unstable_scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  },
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  parameters: z.object({}),
  execute: async () => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      const tasks = agent.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  },
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  parameters: z.object({
    taskId: z.string().describe("The ID of the task to cancel"),
  }),
  execute: async ({ taskId }) => {
    const agent = agentContext.getStore();
    if (!agent) {
      throw new Error("No agent found");
    }
    try {
      await agent.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  },
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  getParkInfo,
  searchParksByState,
  getParkWeatherForecast,
  planParkVisit,
  findNearbyRecreation,
  checkMcpStatus
};

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
};