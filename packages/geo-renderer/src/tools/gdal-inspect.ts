import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runGdal(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(cmd, args, { timeout: 30_000 });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new Error(
        `${cmd} not found. Install GDAL: brew install gdal (macOS) or apt install gdal-bin (Linux)`,
      );
    }
    throw err;
  }
}

export function registerGdalInspect(server: McpServer): void {
  server.tool(
    "gdal_inspect",
    "Inspect a raster or vector geospatial file using gdalinfo or ogrinfo",
    {
      file_path: z.string().describe("Path to the geospatial file"),
      format: z
        .enum(["raster", "vector", "auto"])
        .default("auto")
        .describe("Force raster (gdalinfo) or vector (ogrinfo) inspection"),
      stats: z
        .boolean()
        .default(false)
        .describe("Compute band statistics (raster only)"),
    },
    async (params) => {
      const { file_path, stats } = params;
      let { format } = params;

      // Auto-detect based on extension
      if (format === "auto") {
        const ext = file_path.toLowerCase().split(".").pop() || "";
        const vectorExts = new Set([
          "shp",
          "geojson",
          "json",
          "gpkg",
          "gml",
          "kml",
          "fgb",
          "parquet",
          "geoparquet",
          "csv",
        ]);
        format = vectorExts.has(ext) ? "vector" : "raster";
      }

      let result: string;

      if (format === "vector") {
        const args = [file_path, "-so"];
        const { stdout } = await runGdal("ogrinfo", args);
        result = stdout;
      } else {
        const args = stats ? ["-stats", file_path] : [file_path];
        const { stdout } = await runGdal("gdalinfo", args);
        result = stdout;
      }

      return {
        content: [{ type: "text" as const, text: result }],
      };
    },
  );

  server.tool(
    "gdal_convert",
    "Convert, reproject, clip, or compress geospatial raster files using gdalwarp",
    {
      input_path: z.string().describe("Input raster file path"),
      output_path: z.string().describe("Output raster file path"),
      target_crs: z
        .string()
        .optional()
        .describe("Target CRS (e.g. EPSG:4326)"),
      cutline: z
        .string()
        .optional()
        .describe("Vector file to use as clip boundary"),
      output_format: z
        .string()
        .optional()
        .describe("Output format (GTiff, COG, etc.)"),
      compress: z
        .enum(["LZW", "DEFLATE", "ZSTD", "NONE"])
        .default("LZW")
        .describe("Compression algorithm"),
    },
    async (params) => {
      const args: string[] = [];

      if (params.target_crs) {
        args.push("-t_srs", params.target_crs);
      }
      if (params.cutline) {
        args.push("-cutline", params.cutline, "-crop_to_cutline", "-dstalpha");
      }
      if (params.output_format) {
        args.push("-of", params.output_format);
      }

      args.push(
        "-co",
        `COMPRESS=${params.compress}`,
        "-co",
        "BIGTIFF=YES",
        "-co",
        "NUM_THREADS=ALL_CPUS",
      );

      if (params.compress === "LZW" || params.compress === "DEFLATE") {
        args.push("-co", "PREDICTOR=2");
      }

      args.push(params.input_path, params.output_path);

      const { stdout, stderr } = await runGdal("gdalwarp", args);
      const output = [stdout, stderr].filter(Boolean).join("\n");

      // Verify output
      const { stdout: info } = await runGdal("gdalinfo", [params.output_path]);

      return {
        content: [
          {
            type: "text" as const,
            text: `Converted ${params.input_path} → ${params.output_path}\n\n${info}`,
          },
        ],
      };
    },
  );
}
