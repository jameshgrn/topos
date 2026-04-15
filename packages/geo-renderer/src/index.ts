#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLocatorGlobe } from "./tools/locator-globe.js";
import { registerGdalInspect } from "./tools/gdal-inspect.js";
import { registerOgr2ogr } from "./tools/ogr2ogr.js";
import { registerInteractiveGlobe } from "./tools/interactive-globe.js";

const server = new McpServer({
  name: "geo-renderer",
  version: "0.1.0",
});

registerLocatorGlobe(server);
registerGdalInspect(server);
registerOgr2ogr(server);
registerInteractiveGlobe(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
