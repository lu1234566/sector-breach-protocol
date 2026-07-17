import { defineTool } from "@lovable.dev/mcp-js";

// Static catalog — mirrors src/game-app/data/arenas.ts without importing game
// modules (those depend on Three.js and other browser-only code).
const ARENAS = [
  {
    id: "containment",
    name: "Containment",
    tagline: "Cyan lattice — introduction arena.",
    accent: "cyan",
  },
  {
    id: "reactor",
    name: "Reactor",
    tagline: "Magenta core — mid-tier chokepoints.",
    accent: "magenta",
  },
  {
    id: "causeway",
    name: "Causeway",
    tagline: "Amber corridor — endless-friendly.",
    accent: "amber",
  },
];

export default defineTool({
  name: "get_arena_catalog",
  title: "Get arena catalog",
  description:
    "Return the static list of Protocol DOC arenas (id, name, tagline, accent color). No user data.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(ARENAS) }],
    structuredContent: { arenas: ARENAS },
  }),
});
