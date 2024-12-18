#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

import { createRequire } from "module";
import { verbose_log } from "./logs.js";
import {
    listMemory,
    appendMemory,
    deleteMemory,
    searchMemory,
    readMemories,
} from "./memories.js";

const createServer = async () => {
    const require = createRequire(import.meta.url);
    const {
        name: package_name,
        version: package_version,
    } = require("../package.json");

    const server = new Server(
        {
            name: package_name,
            version: package_version,
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        verbose_log("INFO: ListTools");
        let memories = await readMemories();
        verbose_log("INFO: memories", memories);
        if (memories) {
            memories = "Here are your memories:\n" + memories;
        }
        return {
            tools: [
                {
                    name: "append_memories",
                    description:
                        "Add new memory line(s), use newline to separate",
                    inputSchema: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                        },
                        required: ["text"],
                    },
                },
                {
                    name: "search_memory",
                    description: "Return memory entries containing the query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string" },
                            // PRN no query == ALL? then get rid of list_memory?
                        },
                        required: ["query"],
                    },
                },
                {
                    name: "delete_memory",
                    description: "Delete memory entries containing the query",
                    inputSchema: {
                        type: "object",
                        properties: {
                            // TODO do I need to mention trim leading/trailing whitespace (esp new lines)
                            query: { type: "string" },
                        },
                        required: ["query"],
                    },
                },
                {
                    name: "list_memory",
                    description:
                        // ! TODO I guess in reality, I might have a chat type called "with memory" in which case Claude Desktop app can inject the memories with smth like slash commands and Prompt requests (instead of ToolRequest) ... TBD... that way I can leave instructions too about when to add new memories, update, etc... ok yeah that makes sense
                        "newline delimited list of all memory entries, " +
                        memories,
                    inputSchema: {
                        type: "object",
                    },
                },
                // IDEAS:
                // - extract_keywords/extract_word_cloud (pull from memories, like a word cloud, to help devise a search, esp if memory grows large - can even include frequency if useful, as a more salient memory!?)
                //    speaking of salience, what all could correlate to generate salience (i.e. emotional state in humans imbues salience, i.e. car crash you can remember minute details about a car that 20 years later you can't recall in general but for the accident)
                // - touch_memory
            ],
        };
    });

    server.setRequestHandler(
        CallToolRequestSchema,
        async (request): Promise<{ toolResult: CallToolResult }> => {
            verbose_log("INFO: ToolRequest", request);
            switch (request.params.name) {
                case "append_memories": {
                    const text = request.params.arguments?.text as string;
                    if (!text) {
                        throw new Error("Memory's text is required");
                    }
                    return { toolResult: await appendMemory(text) };
                }
                case "list_memory": {
                    return { toolResult: await listMemory() };
                }
                case "search_memory": {
                    const query = request.params.arguments?.query as string;
                    if (!query) {
                        throw new Error("query is required");
                    }
                    return { toolResult: await searchMemory(query) };
                }
                case "delete_memory": {
                    const query = request.params.arguments?.query as string;
                    if (!query) {
                        throw new Error("query is required");
                    }
                    return { toolResult: await deleteMemory(query) };
                }
                default:
                    throw new Error("Unknown tool");
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
};

createServer().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
