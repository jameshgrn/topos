import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runGdal } from "./gdal-inspect.js";

const FORMAT_MAPPING: Record<string, string> = {
  GeoJSON: "GeoJSON",
  GPKG: "GPKG",
  FlatGeobuf: "FlatGeobuf",
  Shapefile: "ESRI Shapefile",
  CSV: "CSV",
  Parquet: "Parquet",
};

export function registerOgr2ogr(server: McpServer): void {
  server.tool(
    "ogr2ogr_convert",
    "Convert, reproject, filter, or clip vector geospatial files using ogr2ogr",
    {
      input_path: z.string().describe("Input vector file path"),
      output_path: z.string().describe("Output vector file path"),
      output_format: z
        .enum(["GeoJSON", "GPKG", "FlatGeobuf", "Shapefile", "CSV", "Parquet"])
        .default("GeoJSON")
        .describe("Output format"),
      target_crs: z
        .string()
        .optional()
        .describe("Target CRS (e.g. EPSG:4326)"),
      sql_filter: z
        .string()
        .optional()
        .describe("Raw SQL query passed via -sql option"),
      where_clause: z
        .string()
        .optional()
        .describe("Attribute filter passed via -where option"),
      clip_source: z
        .string()
        .optional()
        .describe("Vector file to use as clip boundary via -clipsrc"),
    },
    async (params) => {
      const args: string[] = [];

      // Set output format
      const format = FORMAT_MAPPING[params.output_format];
      args.push("-f", format);

      // Add reprojection if specified
      if (params.target_crs) {
        args.push("-t_srs", params.target_crs);
      }

      // Add SQL filter if specified
      if (params.sql_filter) {
        args.push("-sql", params.sql_filter);
      }

      // Add WHERE clause if specified
      if (params.where_clause) {
        args.push("-where", params.where_clause);
      }

      // Add clip source if specified
      if (params.clip_source) {
        args.push("-clipsrc", params.clip_source);
      }

      // Add output and input paths (ogr2ogr takes output first, then input)
      args.push(params.output_path, params.input_path);

      // Run ogr2ogr
      const { stdout, stderr } = await runGdal("ogr2ogr", args);
      const conversionOutput = [stdout, stderr].filter(Boolean).join("\n");

      // Verify output with ogrinfo
      const { stdout: info } = await runGdal("ogrinfo", ["-so", params.output_path]);

      return {
        content: [
          {
            type: "text" as const,
            text: `Converted ${params.input_path} → ${params.output_path}\n\n${conversionOutput}\nOutput Summary:\n${info}`,
          },
        ],
      };
    },
  );
}
