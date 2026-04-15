import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";

async function findLatestPlanetMosaic(
  apiKey: string,
): Promise<string | null> {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  for (let attempts = 0; attempts < 12; attempts++) {
    month--;
    if (month === 0) {
      month = 12;
      year--;
    }
    const mm = String(month).padStart(2, "0");
    const name = `global_monthly_${year}_${mm}_mosaic`;
    const testUrl = `https://tiles.planet.com/basemaps/v1/planet-tiles/${name}/gmap/2/1/1.png?api_key=${apiKey}`;
    try {
      const res = await fetch(testUrl, { method: "HEAD" });
      if (res.ok) return name;
    } catch {
      continue;
    }
  }
  return null;
}

function buildCesiumHtml(params: {
  latitude: number;
  longitude: number;
  altitude: number;
  cesiumToken: string;
  tileUrl?: string;
  tileAttribution: string;
  geojson_path?: string;
  geojson_url?: string;
  label?: string;
  dark_mode: boolean;
  title: string;
  marker: boolean;
  geojson_color: string;
  geojson_opacity: number;
  auto_rotate: boolean;
  terrain_exaggeration: number;
}): string {
  let geojsonData: string | null = null;
  if (params.geojson_path) {
    geojsonData = readFileSync(params.geojson_path, "utf-8");
  }

  const bg = params.dark_mode ? "#000008" : "#f0f0f0";
  const textColor = params.dark_mode ? "#e0e0e0" : "#333333";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.title}</title>
  <script src="https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Cesium.js"></script>
  <link rel="stylesheet" href="https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/Widgets/widgets.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bg}; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #cesiumContainer { width: 100vw; height: 100vh; }
    .info-panel {
      position: fixed;
      top: 16px;
      left: 16px;
      background: ${params.dark_mode ? "rgba(10,10,20,0.85)" : "rgba(255,255,255,0.9)"};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${textColor};
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.5;
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"};
      z-index: 10;
      max-width: 300px;
      pointer-events: none;
    }
    .info-panel h3 { font-size: 14px; margin-bottom: 4px; }
    .info-panel .coords {
      font-family: "SF Mono", "JetBrains Mono", monospace;
      font-size: 11px;
      opacity: 0.7;
    }
    .info-panel .attribution {
      font-size: 10px;
      opacity: 0.5;
      margin-top: 6px;
    }
    .controls {
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      z-index: 10;
    }
    .controls button {
      background: ${params.dark_mode ? "rgba(10,10,20,0.85)" : "rgba(255,255,255,0.9)"};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${textColor};
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"};
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12px;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: auto;
    }
    .controls button:hover {
      background: ${params.dark_mode ? "rgba(30,30,40,0.9)" : "rgba(240,240,240,0.95)"};
    }
    .controls button.active {
      background: rgba(0,120,255,0.3);
      border-color: rgba(0,120,255,0.5);
    }
    /* Hide Cesium default UI chrome */
    .cesium-viewer-toolbar,
    .cesium-viewer-animationContainer,
    .cesium-viewer-timelineContainer,
    .cesium-viewer-fullscreenContainer,
    .cesium-viewer-bottom,
    .cesium-credit-logoContainer,
    .cesium-credit-expand-link { display: none !important; }
  </style>
</head>
<body>
  <div id="cesiumContainer"></div>
  <div class="info-panel">
    <h3>${params.label || params.title}</h3>
    <div class="coords" id="coords">${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)}</div>
    <div class="attribution">${params.tileAttribution}</div>
  </div>
  <div class="controls">
    <button id="btn-rotate" class="${params.auto_rotate ? "active" : ""}" onclick="toggleRotate()">Spin</button>
    <button onclick="resetView()">Reset</button>
    <button onclick="toggleTerrain()">Terrain</button>
  </div>
  <script>
    Cesium.Ion.defaultAccessToken = ${JSON.stringify(params.cesiumToken)};

    // ESRI Ocean basemap as the base layer (covers ocean areas)
    var esriOcean = new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 16,
      credit: "Esri, GEBCO, NOAA, National Geographic",
    });

    var viewer = new Cesium.Viewer("cesiumContainer", {
      animation: false,
      timeline: false,
      fullscreenButton: false,
      homeButton: false,
      geocoder: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      selectionIndicator: false,
      infoBox: false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayer: new Cesium.ImageryLayer(esriOcean),
    });

    ${params.tileUrl ? `
    // Planet (or custom) imagery on top of ocean basemap
    var planetLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: ${JSON.stringify(params.tileUrl)},
        maximumLevel: 18,
        credit: ${JSON.stringify(params.tileAttribution)},
      })
    );
    ` : ""}

    // Terrain exaggeration
    viewer.scene.verticalExaggeration = ${params.terrain_exaggeration};

    // Lighting — disable sun lighting to prevent washed-out oceans
    viewer.scene.globe.enableLighting = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.brightnessShift = -0.15;
    viewer.scene.skyAtmosphere.saturationShift = 0.1;

    // Ground atmosphere — haze at the horizon / limb of the globe
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.atmosphereBrightnessShift = -0.2;
    viewer.scene.globe.atmosphereSaturationShift = 0.15;

    // Fog — fades distant tiles toward atmosphere color at globe scale
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0002;

    // Darken the ocean base layer slightly
    var oceanLayer = viewer.imageryLayers.get(0);
    oceanLayer.brightness = 0.8;
    oceanLayer.contrast = 1.15;

    // Background
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("${bg}");

    // Initial camera
    var INIT_LAT = ${params.latitude};
    var INIT_LNG = ${params.longitude};
    var INIT_ALT = ${params.altitude};

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(INIT_LNG, INIT_LAT, INIT_ALT),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 0,
    });

    ${params.marker ? `
    // Marker
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(INIT_LNG, INIT_LAT),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString("#cc0000"),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: ${JSON.stringify(params.label || "")},
        font: "14px system-ui, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    ` : ""}

    ${geojsonData ? `
    // Local GeoJSON overlay
    var geojsonData = ${geojsonData};
    var dataSource = Cesium.GeoJsonDataSource.load(geojsonData, {
      stroke: Cesium.Color.fromCssColorString(${JSON.stringify(params.geojson_color)}),
      fill: Cesium.Color.fromCssColorString(${JSON.stringify(params.geojson_color)}).withAlpha(${params.geojson_opacity}),
      strokeWidth: 2,
      clampToGround: true,
    });
    viewer.dataSources.add(dataSource);
    ` : ""}

    ${params.geojson_url ? `
    // Remote GeoJSON overlay
    var remoteSource = Cesium.GeoJsonDataSource.load(${JSON.stringify(params.geojson_url)}, {
      stroke: Cesium.Color.fromCssColorString(${JSON.stringify(params.geojson_color)}),
      fill: Cesium.Color.fromCssColorString(${JSON.stringify(params.geojson_color)}).withAlpha(${params.geojson_opacity}),
      strokeWidth: 2,
      clampToGround: true,
    });
    viewer.dataSources.add(remoteSource);
    ` : ""}


    // Auto-rotate
    var rotating = ${params.auto_rotate};
    function spinGlobe() {
      if (!rotating) return;
      viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.002);
      requestAnimationFrame(spinGlobe);
    }
    if (rotating) spinGlobe();

    // Stop spin on interaction
    var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function() {
      rotating = false;
      document.getElementById("btn-rotate").classList.remove("active");
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    function toggleRotate() {
      rotating = !rotating;
      document.getElementById("btn-rotate").classList.toggle("active", rotating);
      if (rotating) spinGlobe();
    }

    function resetView() {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(INIT_LNG, INIT_LAT, INIT_ALT),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 1.5,
      });
    }

    var terrainOn = true;
    function toggleTerrain() {
      terrainOn = !terrainOn;
      if (terrainOn) {
        viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
      } else {
        viewer.scene.setTerrain(new Cesium.Terrain(Cesium.EllipsoidTerrainProvider.fromUrl()));
      }
    }

    // Update coords on click
    handler.setInputAction(function(movement) {
      var cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        var carto = Cesium.Cartographic.fromCartesian(cartesian);
        var lat = Cesium.Math.toDegrees(carto.latitude);
        var lng = Cesium.Math.toDegrees(carto.longitude);
        document.getElementById("coords").textContent = lat.toFixed(4) + ", " + lng.toFixed(4);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  </script>
</body>
</html>`;
}

export function registerInteractiveGlobe(server: McpServer): void {
  server.tool(
    "interactive_globe",
    "Generate an interactive 3D globe with real terrain (CesiumJS) as a self-contained HTML file. Supports XYZ tile servers, Planet basemaps, GeoJSON overlay, terrain exaggeration, and auto-spin.",
    {
      latitude: z.number().min(-90).max(90).describe("Center latitude"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Center longitude"),
      altitude: z
        .number()
        .default(20000000)
        .describe("Camera altitude in meters (20000000=full globe, 5000000=hemisphere, 500000=regional, 5000=local)"),
      output_path: z.string().describe("File path to write the HTML file"),
      basemap: z
        .enum([
          "planet",
          "osm",
          "esri_imagery",
          "esri_topo",
          "stamen_terrain",
          "carto_dark",
          "carto_light",
          "cesium_default",
        ])
        .default("planet")
        .describe(
          "Basemap preset. 'planet' = latest NICFI monthly (needs PLANET_API_KEY). 'cesium_default' = Cesium ion default imagery.",
        ),
      tile_url: z
        .string()
        .optional()
        .describe(
          "Custom XYZ tile URL template (overrides basemap). Use {z}/{x}/{y} placeholders.",
        ),
      geojson_path: z
        .string()
        .optional()
        .describe("Local GeoJSON file path to overlay on the globe"),
      geojson_url: z
        .string()
        .optional()
        .describe("Remote GeoJSON URL to overlay on the globe"),
      geojson_color: z
        .string()
        .default("#ff4444")
        .describe("GeoJSON overlay color"),
      geojson_opacity: z
        .number()
        .min(0)
        .max(1)
        .default(0.4)
        .describe("GeoJSON fill opacity"),
      label: z
        .string()
        .optional()
        .describe("Label shown in the info panel"),
      title: z
        .string()
        .default("Globe")
        .describe("Page title and info panel heading"),
      dark_mode: z
        .boolean()
        .default(true)
        .describe("Dark mode (true) or light mode (false)"),
      marker: z
        .boolean()
        .default(true)
        .describe("Show a marker at the center point"),
      auto_rotate: z
        .boolean()
        .default(true)
        .describe("Auto-rotate the globe"),
      terrain_exaggeration: z
        .number()
        .min(1)
        .max(100)
        .default(1)
        .describe("Vertical terrain exaggeration factor (1=real, 3=3x, etc.)"),
    },
    async (params) => {
      const cesiumToken = process.env.CESIUM_ION_TOKEN || "";
      if (!cesiumToken) {
        throw new Error(
          "CESIUM_ION_TOKEN environment variable is required. Get one at https://ion.cesium.com/tokens",
        );
      }

      let tileUrl: string | undefined;
      let tileAttribution = "";
      let mosaicInfo = "";

      if (params.tile_url) {
        tileUrl = params.tile_url;
        tileAttribution = "Custom tiles";
      } else if (params.basemap === "planet") {
        const apiKey = process.env.PLANET_API_KEY || "";
        if (!apiKey) {
          throw new Error(
            "PLANET_API_KEY environment variable is required for Planet basemap.",
          );
        }
        const mosaicName = await findLatestPlanetMosaic(apiKey);
        if (!mosaicName) {
          throw new Error("Could not find any available Planet monthly mosaic.");
        }
        tileUrl = `https://tiles.planet.com/basemaps/v1/planet-tiles/${mosaicName}/gmap/{z}/{x}/{y}.png?api_key=${apiKey}`;
        tileAttribution = `Planet Labs — ${mosaicName}`;
        mosaicInfo = ` (${mosaicName})`;
      } else if (params.basemap === "cesium_default") {
        // Use Cesium's default imagery — don't set tileUrl
        tileAttribution = "Cesium ion";
      } else {
        const templates: Record<string, { url: string; attr: string }> = {
          osm: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "OpenStreetMap" },
          esri_imagery: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Esri, Maxar" },
          esri_topo: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", attr: "Esri" },
          stamen_terrain: { url: "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png", attr: "Stadia Maps" },
          carto_dark: { url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attr: "CARTO" },
          carto_light: { url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", attr: "CARTO" },
        };
        const entry = templates[params.basemap] || templates["osm"];
        tileUrl = entry.url;
        tileAttribution = entry.attr;
      }

      const html = buildCesiumHtml({
        ...params,
        cesiumToken,
        tileUrl,
        tileAttribution,
      });
      writeFileSync(params.output_path, html);

      return {
        content: [
          {
            type: "text" as const,
            text: `Interactive 3D globe written to ${params.output_path}\n\nFeatures:\n- Basemap: ${params.basemap}${mosaicInfo}\n- CesiumJS with Cesium World Terrain (real 3D elevation)\n- Terrain exaggeration: ${params.terrain_exaggeration}x\n- ${params.auto_rotate ? "Auto-spin (click to stop)" : "No auto-spin"}\n- Spin / Reset / Terrain toggle buttons\n${params.geojson_path ? "- GeoJSON overlay from " + params.geojson_path + "\n" : ""}${params.geojson_url ? "- GeoJSON overlay from URL\n" : ""}\nOpen in browser: open ${params.output_path}`,
          },
        ],
      };
    },
  );
}
