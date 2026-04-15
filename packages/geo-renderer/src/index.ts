import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerLocatorGlobe } from "./tools/locator-globe.js";
import { registerGdalInspect } from "./tools/gdal-inspect.js";

const server = new McpServer({
  name: "geo-renderer",
  version: "0.1.0",
});

registerLocatorGlobe(server);
registerGdalInspect(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
