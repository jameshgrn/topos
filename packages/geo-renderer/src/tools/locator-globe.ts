import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JSDOM } from "jsdom";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { writeFileSync } from "fs";

const WORLD_ATLAS_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorldTopology = any;

let cachedWorld: WorldTopology | null = null;

async function loadWorld(): Promise<WorldTopology> {
  if (cachedWorld) return cachedWorld;
  const res = await fetch(WORLD_ATLAS_URL);
  cachedWorld = (await res.json()) as WorldTopology;
  return cachedWorld;
}

export function registerLocatorGlobe(server: McpServer): void {
  server.tool(
    "locator_globe",
    "Generate an SVG locator globe centered on a lat/lon with an optional country highlight and label",
    {
      latitude: z.number().min(-90).max(90).describe("Center latitude"),
      longitude: z.number().min(-180).max(180).describe("Center longitude"),
      label: z.string().optional().describe("Label text near the point"),
      highlight_country_id: z
        .string()
        .optional()
        .describe("ISO 3166-1 numeric country code to highlight"),
      size: z
        .number()
        .min(100)
        .max(2000)
        .default(500)
        .describe("SVG width/height in px"),
      output_path: z
        .string()
        .optional()
        .describe("File path to write SVG. If omitted, returns SVG string."),
      ocean_color: z.string().default("#e8f4f8").describe("Ocean fill color"),
      land_color: z.string().default("#d0d0d0").describe("Land fill color"),
      highlight_color: z
        .string()
        .default("#ffcccc")
        .describe("Highlighted country fill"),
      marker_color: z.string().default("#cc0000").describe("Point marker fill"),
      graticule: z
        .boolean()
        .default(true)
        .describe("Show graticule grid lines"),
    },
    async (params) => {
      const world = await loadWorld();
      const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
      const document = dom.window.document;

      const { size, latitude, longitude } = params;

      const projection = d3
        .geoOrthographic()
        .scale(size * 0.48)
        .translate([size / 2, size / 2])
        .rotate([-longitude, -latitude])
        .clipAngle(90);

      const path = d3.geoPath(projection);

      const svg = d3
        .select(document.body)
        .append("svg")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("width", size)
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`);

      // Ocean
      svg
        .append("path")
        .datum({ type: "Sphere" } as unknown as GeoJSON.GeoJsonObject)
        .attr("d", path as any)
        .attr("fill", params.ocean_color)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 0.5);

      // Graticule
      if (params.graticule) {
        svg
          .append("path")
          .datum(d3.geoGraticule10())
          .attr("d", path as any)
          .attr("fill", "none")
          .attr("stroke", "#ddd")
          .attr("stroke-width", 0.3);
      }

      // Countries
      const countries = topojson.feature(
        world as any,
        world.objects.countries as any,
      ) as unknown as GeoJSON.FeatureCollection;

      svg
        .selectAll("path.country")
        .data(countries.features)
        .join("path")
        .attr("class", "country")
        .attr("d", (d: any) => path(d) || "")
        .attr("fill", (d: any) =>
          params.highlight_country_id && d.id === params.highlight_country_id
            ? params.highlight_color
            : params.land_color,
        )
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5);

      // Country borders
      const borders = topojson.mesh(
        world as any,
        world.objects.countries as any,
        (a: any, b: any) => a !== b,
      );
      svg
        .append("path")
        .datum(borders)
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3);

      // Point marker
      const projected = projection([longitude, latitude]);
      if (projected) {
        const [px, py] = projected;
        // Outer halo
        svg
          .append("circle")
          .attr("cx", px)
          .attr("cy", py)
          .attr("r", 8)
          .attr("fill", "none")
          .attr("stroke", params.marker_color)
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.4);
        // Inner dot
        svg
          .append("circle")
          .attr("cx", px)
          .attr("cy", py)
          .attr("r", 4)
          .attr("fill", params.marker_color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1);

        // Label
        if (params.label) {
          svg
            .append("text")
            .attr("x", px + 12)
            .attr("y", py + 5)
            .attr("font-family", "Helvetica, Arial, sans-serif")
            .attr("font-size", Math.max(12, size * 0.028))
            .attr("font-weight", "bold")
            .attr("fill", "#333")
            .text(params.label);
        }
      }

      const svgString = document.body.innerHTML;

      if (params.output_path) {
        writeFileSync(params.output_path, svgString);
        return {
          content: [
            {
              type: "text" as const,
              text: `SVG written to ${params.output_path}`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: svgString }],
      };
    },
  );
}
