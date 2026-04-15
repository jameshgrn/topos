import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLocatorGlobe } from "../src/tools/locator-globe.js";

// Minimal world-atlas TopoJSON fixture with one country polygon
const mockWorldAtlas = {
  type: "Topology",
  objects: {
    countries: {
      type: "GeometryCollection",
      geometries: [
        {
          type: "Polygon",
          id: "772", // Tonga ISO 3166-1 numeric code
          arcs: [[0]],
          properties: { name: "Tonga" },
        },
      ],
    },
  },
  arcs: [
    [
      [100, 0],
      [101, 0],
      [101, 1],
      [100, 1],
      [100, 0],
    ],
  ],
  bbox: [100, 0, 101, 1],
};

describe("registerLocatorGlobe", () => {
  beforeEach(() => {
    // Mock global fetch to return the mock world atlas
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWorldAtlas,
    } as Response);
  });

  it("should register tool on McpServer without throwing", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.1.0",
    });

    expect(() => registerLocatorGlobe(server)).not.toThrow();
  });

  it("should generate SVG with expected elements for Tonga coordinates", async () => {
    // Create a mock server that captures the tool handler
    let capturedHandler: Function | null = null;

    const mockServer = {
      tool: vi.fn(
        (
          name: string,
          _description: string,
          _params: Record<string, unknown>,
          handler: Function
        ) => {
          if (name === "locator_globe") {
            capturedHandler = handler;
          }
        }
      ),
    } as unknown as McpServer;

    registerLocatorGlobe(mockServer);

    expect(capturedHandler).not.toBeNull();
    expect(mockServer.tool).toHaveBeenCalledWith(
      "locator_globe",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );

    // Call the captured handler with Tonga coordinates
    const result = await capturedHandler!({
      latitude: -21.2,
      longitude: -175.2,
      label: "TONGA",
      size: 500,
      ocean_color: "#e8f4f8",
      land_color: "#d0d0d0",
      highlight_color: "#ffcccc",
      marker_color: "#cc0000",
      graticule: true,
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);

    const svgString = result.content[0].text;

    // Assert the output SVG contains expected elements
    expect(svgString).toContain("<svg");
    expect(svgString).toContain("<path");
    expect(svgString).toContain("<circle");
    expect(svgString).toContain("TONGA");
  });
});
