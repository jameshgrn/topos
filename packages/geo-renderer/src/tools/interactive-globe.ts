import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { createServer, type Server } from "http";
import { exec } from "child_process";
import { dirname, basename } from "path";

let activeServer: Server | null = null;

function serveAndOpen(filePath: string, port: number): string {
  if (activeServer) {
    activeServer.close();
  }

  const dir = dirname(filePath);
  const file = basename(filePath);

  activeServer = createServer((req, res) => {
    const requestedFile = req.url === "/" ? `/${file}` : req.url!;
    const fullPath = `${dir}${requestedFile}`;
    try {
      const content = readFileSync(fullPath);
      const ext = fullPath.split(".").pop();
      const types: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
      };
      res.writeHead(200, { "Content-Type": types[ext || "html"] || "application/octet-stream" });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  activeServer.listen(port);
  const url = `http://localhost:${port}/${file}`;
  exec(`open "${url}"`);
  return url;
}

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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${bg}; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #cesiumContainer { width: 100vw; height: 100vh; }
    .info-panel {
      position: fixed;
      top: 20px;
      left: 20px;
      color: ${textColor};
      z-index: 10;
      pointer-events: none;
    }
    .info-title {
      font-family: 'Syne', sans-serif;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: ${params.dark_mode ? "rgba(255,255,255,0.92)" : "rgba(10,10,30,0.9)"};
      text-shadow: ${params.dark_mode ? "0 2px 20px rgba(0,0,0,0.6)" : "0 2px 10px rgba(255,255,255,0.6)"};
    }
    .info-coords {
      font-family: "DM Mono", "SF Mono", monospace;
      font-size: 13px;
      opacity: 0.55;
      letter-spacing: 0.04em;
      margin-top: 6px;
      transition: opacity 0.2s;
    }
    .info-coords.tracking { opacity: 0.8; }
    .info-providers {
      font-family: "DM Mono", "SF Mono", monospace;
      font-size: 10px;
      opacity: 0.35;
      margin-top: 4px;
      letter-spacing: 0.02em;
      max-width: 400px;
    }
    .controls {
      position: fixed;
      bottom: 140px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 10;
    }
    .controls button {
      background: ${params.dark_mode ? "rgba(12,14,26,0.88)" : "rgba(252,253,255,0.92)"};
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: ${textColor};
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)"};
      border-radius: 7px;
      padding: 7px 14px;
      font-size: 11px; font-weight: 500; letter-spacing: 0.04em;
      cursor: pointer;
      font-family: "DM Mono", "SF Mono", monospace;
      pointer-events: auto;
      transition: background 0.12s, box-shadow 0.12s;
      box-shadow: ${params.dark_mode ? "0 3px 8px rgba(0,0,0,0.35)" : "0 3px 8px rgba(0,0,0,0.07)"};
      text-align: center;
    }
    .controls button:hover {
      background: ${params.dark_mode ? "rgba(24,26,40,0.96)" : "rgba(244,246,252,0.99)"};
      box-shadow: ${params.dark_mode ? "0 5px 12px rgba(0,0,0,0.45)" : "0 5px 12px rgba(0,0,0,0.1)"};
    }
    .spin-speed {
      display: flex; align-items: center; gap: 4px;
      background: ${params.dark_mode ? "rgba(12,14,26,0.88)" : "rgba(252,253,255,0.92)"};
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)"};
      border-radius: 7px; padding: 5px 10px;
      font-family: "DM Mono", "SF Mono", monospace; color: ${textColor};
      box-shadow: ${params.dark_mode ? "0 3px 8px rgba(0,0,0,0.35)" : "0 3px 8px rgba(0,0,0,0.07)"};
    }
    .controls button.active {
      background: ${params.dark_mode ? "rgba(80,130,255,0.22)" : "rgba(30,80,220,0.1)"};
      border-color: ${params.dark_mode ? "rgba(80,130,255,0.45)" : "rgba(30,80,220,0.3)"};
      color: ${params.dark_mode ? "rgba(140,180,255,1)" : "rgba(30,80,220,1)"};
    }
    /* ── Layer panel ── */
    .layer-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 300px;
      background: ${params.dark_mode
        ? "linear-gradient(160deg, rgba(12,14,26,0.97) 0%, rgba(8,10,20,0.97) 100%)"
        : "linear-gradient(160deg, rgba(252,253,255,0.98) 0%, rgba(244,246,252,0.98) 100%)"};
      backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
      color: ${textColor};
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.09)"};
      border-radius: 0; max-height: 100vh; overflow-y: auto;
      z-index: 10; font-size: 13px;
      transform: translateX(100%); transition: transform 0.25s ease;
      box-shadow: ${params.dark_mode
        ? "0 24px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
        : "0 24px 48px rgba(0,0,20,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)"};
    }
    .layer-panel { display: flex; flex-direction: column; }
    .layer-panel.visible { transform: translateX(0); }
    .lp-toggle {
      position: fixed; top: 16px; right: 16px;
      background: ${params.dark_mode ? "rgba(12,14,26,0.88)" : "rgba(252,253,255,0.92)"};
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      color: ${textColor};
      border: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"};
      border-radius: 8px; padding: 7px 14px; font-size: 11px; font-weight: 500;
      letter-spacing: 0.04em;
      cursor: pointer; font-family: 'DM Mono', 'SF Mono', monospace; z-index: 11;
      transition: background 0.15s, box-shadow 0.15s;
      box-shadow: ${params.dark_mode ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)"};
    }
    .lp-toggle:hover {
      background: ${params.dark_mode ? "rgba(24,26,40,0.95)" : "rgba(244,246,252,0.98)"};
      box-shadow: ${params.dark_mode ? "0 6px 16px rgba(0,0,0,0.5)" : "0 6px 16px rgba(0,0,0,0.12)"};
    }
    .lp-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px 10px;
      border-bottom: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"};
      flex-shrink: 0;
    }
    .lp-panel-title {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 10px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
      color: ${params.dark_mode ? "rgba(160,175,210,0.55)" : "rgba(40,50,80,0.5)"};
    }
    .lp-panel-close {
      cursor: pointer; font-size: 16px; line-height: 1;
      color: ${params.dark_mode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"};
      width: 20px; text-align: center;
      transition: color 0.12s;
    }
    .lp-panel-close:hover { color: ${params.dark_mode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)"}; }
    .lp-section-head {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em;
      color: ${params.dark_mode ? "rgba(160,175,210,0.35)" : "rgba(40,50,80,0.35)"};
      padding: 10px 14px 3px; font-weight: 500;
    }
    /* Active layer stack */
    .lp-stack { min-height: 20px; }
    .lp-layer {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px 8px 8px; cursor: grab;
      border-bottom: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.035)"};
      transition: background 0.1s;
    }
    .lp-layer:hover { background: ${params.dark_mode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)"}; }
    .lp-layer:active { cursor: grabbing; }
    .lp-layer.drag-over { border-top: 2px solid ${params.dark_mode ? "rgba(80,130,255,0.7)" : "rgba(30,80,220,0.6)"}; }
    .lp-grip {
      color: ${params.dark_mode ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)"};
      font-size: 10px; cursor: grab; user-select: none; flex-shrink: 0; width: 14px; text-align: center;
    }
    .lp-eye { cursor: pointer; font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; opacity: 0.65; transition: opacity 0.1s; }
    .lp-eye:hover { opacity: 1; }
    .lp-eye.hidden { opacity: 0.25; }
    .lp-name {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 14px; letter-spacing: 0.01em;
    }
    .lp-remove {
      cursor: pointer; font-size: 15px; flex-shrink: 0; width: 18px; text-align: center;
      opacity: 0.2; transition: opacity 0.1s, color 0.1s;
    }
    .lp-remove:hover { opacity: 0.85; color: #ff5555; }
    /* Add layer catalog */
    .lp-catalog { border-top: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}; }
    .lp-cat-item {
      padding: 4px 14px; cursor: pointer; display: flex; align-items: center; gap: 7px;
      font-size: 11.5px; transition: background 0.1s;
    }
    .lp-cat-item:hover { background: ${params.dark_mode ? "rgba(80,130,255,0.08)" : "rgba(30,80,220,0.05)"}; }
    .lp-cat-item .plus {
      color: ${params.dark_mode ? "rgba(80,130,255,0.75)" : "rgba(30,80,220,0.7)"};
      font-weight: 600; flex-shrink: 0; font-size: 13px; line-height: 1;
    }
    .lp-sub-toggle {
      padding: 5px 14px; cursor: pointer; display: flex; align-items: center; gap: 7px;
      color: ${params.dark_mode ? "rgba(200,210,240,0.7)" : "rgba(20,30,60,0.7)"};
      font-weight: 500; font-size: 11.5px; transition: background 0.1s;
    }
    .lp-sub-toggle:hover { background: ${params.dark_mode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}; }
    .lp-sub-toggle .arrow { font-size: 8px; transition: transform 0.15s; opacity: 0.5; }
    .lp-sub-toggle.open .arrow { transform: rotate(90deg); }
    .lp-sub-list { display: none; }
    .lp-sub-list.open { display: block; }
    .lp-sub-list .lp-cat-item { padding-left: 26px; font-size: 11px; }
    .lp-loading {
      padding: 5px 26px; font-size: 10.5px;
      font-family: 'DM Mono', 'SF Mono', monospace; font-style: italic;
      color: ${params.dark_mode ? "rgba(160,175,210,0.3)" : "rgba(40,50,80,0.3)"};
    }
    /* ── Time control bar ── */
    .time-control-bar {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: ${params.dark_mode
        ? "linear-gradient(180deg, rgba(6,8,18,0) 0%, rgba(6,8,18,0.72) 18%, rgba(6,8,18,0.96) 100%)"
        : "linear-gradient(180deg, rgba(240,242,248,0) 0%, rgba(240,242,248,0.75) 18%, rgba(240,242,248,0.98) 100%)"};
      backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      color: ${textColor};
      z-index: 10; display: none;
      flex-direction: column; align-items: stretch;
      padding: 20px 32px 16px;
      border-top: 1px solid ${params.dark_mode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"};
      gap: 0;
      pointer-events: auto;
    }
    .time-control-bar.visible { display: flex; }

    /* Big date headline */
    .tc-headline {
      display: flex; align-items: baseline; justify-content: center; gap: 18px;
      margin-bottom: 14px;
    }
    .tc-active-date {
      font-family: 'Syne', 'SF Pro Display', system-ui, sans-serif;
      font-weight: 800; font-size: 32px; letter-spacing: -0.03em;
      line-height: 1; color: ${params.dark_mode ? "#f0f4ff" : "#0a0c14"};
      transition: color 0.2s;
    }
    .tc-active-type {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 11px; font-weight: 400; letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${params.dark_mode ? "rgba(160,175,210,0.6)" : "rgba(40,50,80,0.5)"};
      align-self: center;
    }

    /* Play button */
    .tc-play-btn {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 50%;
      background: ${params.dark_mode ? "rgba(80,130,255,0.18)" : "rgba(30,80,220,0.12)"};
      border: 1px solid ${params.dark_mode ? "rgba(80,130,255,0.35)" : "rgba(30,80,220,0.25)"};
      color: ${params.dark_mode ? "rgba(120,160,255,1)" : "rgba(30,80,220,1)"};
      cursor: pointer; font-size: 13px; flex-shrink: 0;
      transition: background 0.15s, transform 0.1s;
    }
    .tc-play-btn:hover { background: ${params.dark_mode ? "rgba(80,130,255,0.3)" : "rgba(30,80,220,0.2)"}; transform: scale(1.06); }
    .tc-play-btn.playing { background: ${params.dark_mode ? "rgba(80,130,255,0.32)" : "rgba(30,80,220,0.22)"}; border-color: ${params.dark_mode ? "rgba(80,130,255,0.6)" : "rgba(30,80,220,0.5)"}; }

    /* Slider rows */
    .tc-sliders { display: flex; flex-direction: column; gap: 10px; width: 100%; }
    .tc-row {
      display: grid; grid-template-columns: 88px 1fr 96px;
      align-items: center; gap: 12px;
    }
    .tc-row-label {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 10px; font-weight: 500; letter-spacing: 0.1em;
      text-transform: uppercase;
      color: ${params.dark_mode ? "rgba(160,175,210,0.45)" : "rgba(40,50,80,0.45)"};
      text-align: right; white-space: nowrap;
    }
    .tc-row.active-row .tc-row-label {
      color: ${params.dark_mode ? "rgba(120,160,255,0.85)" : "rgba(30,80,220,0.75)"};
    }
    .tc-row-date {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 11px; font-weight: 400;
      color: ${params.dark_mode ? "rgba(200,210,240,0.6)" : "rgba(40,50,80,0.55)"};
      text-align: left; white-space: nowrap; letter-spacing: 0.04em;
    }
    .tc-row.active-row .tc-row-date {
      color: ${params.dark_mode ? "rgba(200,220,255,0.95)" : "rgba(30,80,220,0.9)"};
      font-weight: 500;
    }
    .tc-row-loading {
      font-family: 'DM Mono', 'SF Mono', monospace;
      font-size: 10px; font-style: italic;
      color: ${params.dark_mode ? "rgba(160,175,210,0.35)" : "rgba(40,50,80,0.35)"};
      grid-column: 2 / 4;
    }

    /* Range input styling */
    .tc-range {
      width: 100%; height: 3px; cursor: pointer;
      -webkit-appearance: none; appearance: none;
      background: transparent; outline: none;
    }
    .tc-range::-webkit-slider-runnable-track {
      height: 3px; border-radius: 2px;
      background: ${params.dark_mode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
    }
    .tc-row.active-row .tc-range::-webkit-slider-runnable-track {
      background: linear-gradient(90deg,
        ${params.dark_mode ? "rgba(80,130,255,0.6)" : "rgba(30,80,220,0.45)"},
        ${params.dark_mode ? "rgba(120,180,255,0.4)" : "rgba(80,140,240,0.3)"});
    }
    .tc-range::-webkit-slider-thumb {
      -webkit-appearance: none; width: 14px; height: 14px;
      border-radius: 50%; margin-top: -5.5px;
      background: ${params.dark_mode ? "rgba(80,80,90,0.9)" : "rgba(180,185,200,0.9)"};
      border: 2px solid ${params.dark_mode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
      transition: transform 0.1s, background 0.15s;
    }
    .tc-row.active-row .tc-range::-webkit-slider-thumb {
      background: ${params.dark_mode ? "#6090ff" : "#1e50dc"};
      border-color: ${params.dark_mode ? "rgba(120,160,255,0.5)" : "rgba(30,80,220,0.4)"};
      box-shadow: 0 0 0 3px ${params.dark_mode ? "rgba(80,130,255,0.2)" : "rgba(30,80,220,0.15)"};
    }
    .tc-range::-webkit-slider-thumb:hover { transform: scale(1.2); }
    .tc-range::-moz-range-track {
      height: 3px; border-radius: 2px;
      background: ${params.dark_mode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
    }
    .tc-row.active-row .tc-range::-moz-range-track {
      background: ${params.dark_mode ? "rgba(80,130,255,0.5)" : "rgba(30,80,220,0.35)"};
    }
    .tc-range::-moz-range-thumb {
      width: 14px; height: 14px; border-radius: 50%;
      background: ${params.dark_mode ? "rgba(80,80,90,0.9)" : "rgba(180,185,200,0.9)"};
      border: 2px solid ${params.dark_mode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)"};
    }
    .tc-row.active-row .tc-range::-moz-range-thumb {
      background: ${params.dark_mode ? "#6090ff" : "#1e50dc"};
    }

    /* Divider between sliders */
    .tc-divider {
      height: 1px;
      background: ${params.dark_mode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"};
      margin: 2px 0;
    }
    .layer-panel::-webkit-scrollbar { width: 6px; }
    .layer-panel::-webkit-scrollbar-track { background: transparent; }
    .layer-panel::-webkit-scrollbar-thumb { background: ${params.dark_mode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}; border-radius: 3px; }
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
    <div class="info-title">${params.label || params.title || "Gearon's Globe Emporium"}</div>
    <div class="info-coords" id="coords">${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)}</div>
    <div class="info-providers" id="providerList"></div>
  </div>
  <div class="controls">
    <button id="btn-rotate" class="${params.auto_rotate ? "active" : ""}" onclick="toggleRotate()">Spin</button>
    <div class="spin-speed" id="spinSpeedCtrl" ${params.auto_rotate ? "" : 'style="display:none"'}>
      <input type="range" min="0" max="100" value="40" oninput="setSpinSpeed(this.value)" style="width:100px;accent-color:rgba(80,130,255,0.8);" />
      <span id="speedLabel" style="font-size:10px;opacity:0.5;min-width:28px;text-align:right;">1x</span>
    </div>
    <button onclick="resetView()">Reset</button>
    <button onclick="toggleTerrain()">Terrain</button>
  </div>
  <button class="lp-toggle" id="lpToggleBtn" onclick="togglePanel()">&#9776;&ensp;Layers</button>
  <div class="layer-panel" id="layerPanel">
    <div class="lp-panel-header">
      <span class="lp-panel-title">Layer Stack</span>
      <span class="lp-panel-close" onclick="togglePanel()">&#215;</span>
    </div>
    <div class="lp-section-head">Active &mdash; drag to reorder</div>
    <div class="lp-stack" id="layerStack"></div>
    <div class="lp-catalog">
      <div class="lp-section-head">Add Layer</div>
      ${params.tileUrl && params.tileAttribution.includes("Planet") ? `
      <div class="lp-sub-toggle" onclick="toggleSub('planet-monthly')"><span class="arrow">&#9654;</span> Planet Monthly</div>
      <div class="lp-sub-list" id="planet-monthly"><div class="lp-loading">Loading catalog...</div></div>
      <div class="lp-sub-toggle" onclick="toggleSub('planet-quarterly')"><span class="arrow">&#9654;</span> Planet Quarterly</div>
      <div class="lp-sub-list" id="planet-quarterly"><div class="lp-loading">Loading catalog...</div></div>
      ` : ""}
      <div class="lp-section-head" style="padding-top:6px">Satellite / Imagery</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri World Imagery')"><span class="plus">+</span> Esri World Imagery</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('USGS Imagery')"><span class="plus">+</span> USGS Imagery</div>
      <div class="lp-section-head">Ocean / Terrain</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri Ocean')"><span class="plus">+</span> Esri Ocean</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri Shaded Relief')"><span class="plus">+</span> Esri Shaded Relief</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('OpenTopoMap')"><span class="plus">+</span> OpenTopoMap</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri World Topo')"><span class="plus">+</span> Esri World Topo</div>
      <div class="lp-section-head">Street / General</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('OSM Standard')"><span class="plus">+</span> OSM Standard</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('CartoDB Voyager')"><span class="plus">+</span> CartoDB Voyager</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('CartoDB Positron')"><span class="plus">+</span> CartoDB Positron</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('CartoDB Dark Matter')"><span class="plus">+</span> CartoDB Dark Matter</div>
      <div class="lp-section-head">Reference</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri NatGeo')"><span class="plus">+</span> Esri NatGeo</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Esri Gray Canvas')"><span class="plus">+</span> Esri Gray Canvas</div>
      <div class="lp-section-head">Artistic</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Stamen Toner')"><span class="plus">+</span> Stamen Toner</div>
      <div class="lp-cat-item" onclick="addLayerFromCatalog('Stamen Watercolor')"><span class="plus">+</span> Stamen Watercolor</div>
    </div>
  </div>
  <div class="time-control-bar" id="timeControlBar">
    <div class="tc-headline">
      <button class="tc-play-btn" id="tcPlayBtn" onclick="togglePlay()" title="Animate through time">&#9654;</button>
      <span class="tc-active-date" id="tcActiveDate">—</span>
      <span class="tc-active-type" id="tcActiveType">Monthly</span>
    </div>
    <div class="tc-sliders">
      <div class="tc-row active-row" id="tc-row-monthly">
        <span class="tc-row-label">Monthly</span>
        <span class="tc-row-loading" id="tc-loading-monthly">Loading…</span>
        <input type="range" class="tc-range" id="tc-range-monthly" min="0" max="0" value="0" style="display:none" oninput="onSliderInput('monthly', this.value)" onfocus="setActiveSlider('monthly')" />
        <span class="tc-row-date" id="tc-date-monthly" style="display:none">—</span>
      </div>
      <div class="tc-divider"></div>
      <div class="tc-row" id="tc-row-quarterly">
        <span class="tc-row-label">Quarterly</span>
        <span class="tc-row-loading" id="tc-loading-quarterly">Loading…</span>
        <input type="range" class="tc-range" id="tc-range-quarterly" min="0" max="0" value="0" style="display:none" oninput="onSliderInput('quarterly', this.value)" onfocus="setActiveSlider('quarterly')" />
        <span class="tc-row-date" id="tc-date-quarterly" style="display:none">—</span>
      </div>
    </div>
  </div>
  <script>
    Cesium.Ion.defaultAccessToken = ${JSON.stringify(params.cesiumToken)};

    var PLANET_API_KEY = ${JSON.stringify(params.tileUrl && params.tileAttribution.includes("Planet") ? (params.tileUrl.match(/api_key=([^&]+)/)?.[1] || "") : "")};
    var PLANET_TILE_BASE = "https://tiles.planet.com/basemaps/v1/planet-tiles/";
    var PLANET_TILE_SUFFIX = "/gmap/{z}/{x}/{y}.png";
    var PLANET_API_BASE = "https://api.planet.com/basemaps/v1/mosaics";
    function planetTileUrl(n) { return PLANET_TILE_BASE + n + PLANET_TILE_SUFFIX + "?" + "api" + "_key=" + PLANET_API_KEY; }

    var BASEMAPS = {
      "Esri World Imagery": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", maxZoom: 18, attr: "Esri, Maxar" },
      "USGS Imagery": { url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}", maxZoom: 20, attr: "USGS" },
      "Esri Ocean": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", maxZoom: 13, attr: "Esri, GEBCO, NOAA" },
      "Esri Shaded Relief": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}", maxZoom: 13, attr: "Esri" },
      "OpenTopoMap": { url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", maxZoom: 17, attr: "OpenTopoMap" },
      "Esri World Topo": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", maxZoom: 18, attr: "Esri" },
      "OSM Standard": { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, attr: "OpenStreetMap" },
      "CartoDB Voyager": { url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", maxZoom: 20, attr: "CARTO" },
      "CartoDB Positron": { url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", maxZoom: 20, attr: "CARTO" },
      "CartoDB Dark Matter": { url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", maxZoom: 20, attr: "CARTO" },
      "Esri NatGeo": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", maxZoom: 16, attr: "Esri, National Geographic" },
      "Esri Gray Canvas": { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", maxZoom: 16, attr: "Esri" },
      "Stamen Toner": { url: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png", maxZoom: 20, attr: "Stadia Maps" },
      "Stamen Watercolor": { url: "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg", maxZoom: 18, attr: "Stadia Maps" },
    };

    // --- Layer management ---
    var activeLayers = {};  // name → { layer, visible }
    var layerOrder = [];    // names, top of array = top of render stack

    function addLayer(name) {
      var bm = BASEMAPS[name];
      if (!bm || !bm.url || activeLayers[name]) return;
      var layer = viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({ url: bm.url, maximumLevel: bm.maxZoom, credit: bm.attr })
      );
      activeLayers[name] = { layer: layer, visible: true };
      layerOrder.push(name);
      renderStack();
    }

    function removeLayerByName(name) {
      var entry = activeLayers[name];
      if (!entry) return;
      viewer.imageryLayers.remove(entry.layer);
      delete activeLayers[name];
      layerOrder = layerOrder.filter(function(n) { return n !== name; });
      renderStack();
    }

    function toggleVisibility(name) {
      var entry = activeLayers[name];
      if (!entry) return;
      entry.visible = !entry.visible;
      entry.layer.show = entry.visible;
      renderStack();
    }

    function addLayerFromCatalog(name) {
      if (activeLayers[name]) return; // already added
      addLayer(name);
    }

    // Reorder Cesium imagery layers to match layerOrder (index 0 = bottom)
    function syncCesiumOrder() {
      for (var i = 0; i < layerOrder.length; i++) {
        var entry = activeLayers[layerOrder[i]];
        if (!entry) continue;
        var cesiumIdx = viewer.imageryLayers.indexOf(entry.layer);
        if (cesiumIdx !== i && cesiumIdx >= 0) {
          // Move to correct position
          while (viewer.imageryLayers.indexOf(entry.layer) > i) viewer.imageryLayers.lower(entry.layer);
          while (viewer.imageryLayers.indexOf(entry.layer) < i) viewer.imageryLayers.raise(entry.layer);
        }
      }
    }

    // Render the active layer stack UI
    function renderStack() {
      var stack = document.getElementById("layerStack");
      stack.innerHTML = "";
      // Render top-to-bottom (reverse of layerOrder since layerOrder[0] = bottom)
      var reversed = layerOrder.slice().reverse();
      reversed.forEach(function(name) {
        var entry = activeLayers[name];
        if (!entry) return;
        var label = name.replace("global_monthly_", "").replace("global_quarterly_", "").replace("_mosaic", "").replace(/_/g, "-");
        var div = document.createElement("div");
        div.className = "lp-layer";
        div.draggable = true;
        div.dataset.name = name;
        div.innerHTML =
          '<span class="lp-grip">&#9776;</span>' +
          '<span class="lp-eye' + (entry.visible ? "" : " hidden") + '" onclick="event.stopPropagation();toggleVisibility(\\'' + name.replace(/'/g, "\\\\'") + '\\')">' + (entry.visible ? "&#128065;" : "&#8212;") + '</span>' +
          '<span class="lp-name">' + label + '</span>' +
          '<span class="lp-remove" onclick="event.stopPropagation();removeLayerByName(\\'' + name.replace(/'/g, "\\\\'") + '\\')">&times;</span>';
        // Drag events
        div.addEventListener("dragstart", function(e) { e.dataTransfer.setData("text/plain", name); div.style.opacity = "0.4"; });
        div.addEventListener("dragend", function() { div.style.opacity = "1"; document.querySelectorAll(".lp-layer").forEach(function(el) { el.classList.remove("drag-over"); }); });
        div.addEventListener("dragover", function(e) { e.preventDefault(); div.classList.add("drag-over"); });
        div.addEventListener("dragleave", function() { div.classList.remove("drag-over"); });
        div.addEventListener("drop", function(e) {
          e.preventDefault();
          div.classList.remove("drag-over");
          var draggedName = e.dataTransfer.getData("text/plain");
          if (draggedName === name) return;
          // Reorder: dragged goes above drop target in visual (which is before in reversed array)
          var newOrder = layerOrder.slice();
          newOrder = newOrder.filter(function(n) { return n !== draggedName; });
          var dropIdx = newOrder.indexOf(name);
          // Insert after dropIdx (since layerOrder is bottom-to-top, inserting after = visually above)
          newOrder.splice(dropIdx + 1, 0, draggedName);
          layerOrder = newOrder;
          syncCesiumOrder();
          renderStack();
        });
        stack.appendChild(div);
      });
      // Update attribution
      var attrs = layerOrder.filter(function(n) { return activeLayers[n] && activeLayers[n].visible; }).map(function(n) { return BASEMAPS[n] ? BASEMAPS[n].attr : ""; });
      // Provider list is now updated via updateProviderList() wrapper
    }

    function togglePanel() {
      var panel = document.getElementById("layerPanel");
      var btn = document.getElementById("lpToggleBtn");
      var visible = panel.classList.toggle("visible");
      btn.style.display = visible ? "none" : "";
    }

    // --- Planet catalog + dual time sliders ---
    var planetMosaics = { monthly: [], quarterly: [] };
    var activeTimeLayer = null;   // name of current Planet mosaic shown on globe
    var activeSliderType = "monthly";  // which slider is "in control"
    var playInterval = null;      // setInterval handle for animation

    function toggleSub(id) {
      var listEl = document.getElementById(id);
      var toggleEl = listEl.previousElementSibling;
      var isOpen = listEl.classList.toggle("open");
      toggleEl.classList.toggle("open", isOpen);
    }

    // Human-readable mosaic label
    // "global_monthly_2025_03_mosaic" → "March 2025"
    // "global_quarterly_2025_q1_mosaic" → "Q1 2025"
    function mosaicLabel(name) {
      var MONTHS = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
      var mM = name.match(/global_monthly_(\d{4})_(\d{2})_mosaic/);
      if (mM) {
        var yr = mM[1], mo = parseInt(mM[2], 10);
        return MONTHS[mo - 1] + " " + yr;
      }
      var mQ = name.match(/global_quarterly_(\d{4})_(q\d)_mosaic/i);
      if (mQ) return mQ[2].toUpperCase() + " " + mQ[1];
      // Fallback: pretty-print whatever is in there
      return name.replace("global_monthly_","").replace("global_quarterly_","").replace("_mosaic","").replace(/_/g,"-");
    }

    function setActiveSlider(type) {
      activeSliderType = type;
      document.getElementById("tc-row-monthly").classList.toggle("active-row", type === "monthly");
      document.getElementById("tc-row-quarterly").classList.toggle("active-row", type === "quarterly");
      document.getElementById("tcActiveType").textContent = type === "monthly" ? "Monthly" : "Quarterly";
      // Update headline date to this slider's current selection
      var mosaics = planetMosaics[type];
      if (mosaics && mosaics.length) {
        var idx = parseInt(document.getElementById("tc-range-" + type).value, 10);
        document.getElementById("tcActiveDate").textContent = mosaicLabel(mosaics[idx]);
      }
    }

    function loadPlanetCatalog(type) {
      if (!PLANET_API_KEY) return;
      var listEl = document.getElementById("planet-" + type);
      if (listEl) listEl.innerHTML = '<div class="lp-loading">Loading…</div>';
      var nameFilter = type === "monthly" ? "global_monthly" : "global_quarterly";
      var url = PLANET_API_BASE + "?name__contains=" + nameFilter + "&_page_size=500";
      fetch(url, { headers: { "Authorization": "Basic " + btoa(PLANET_API_KEY + ":") } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var mosaics = (data.mosaics || []).map(function(m) { return m.name; }).sort();
          planetMosaics[type] = mosaics;
          if (listEl) {
            listEl.innerHTML = "";
            // Populate sub-list in layer catalog
            mosaics.slice().reverse().forEach(function(name) {
              var item = document.createElement("div");
              item.className = "lp-cat-item";
              item.onclick = function() { addLayerFromCatalog(name); };
              item.innerHTML = '<span class="plus">+</span> ' + mosaicLabel(name);
              listEl.appendChild(item);
            });
          }
          mosaics.forEach(function(name) {
            BASEMAPS[name] = { url: planetTileUrl(name), maxZoom: 18, attr: "Planet Labs" };
          });
          // Wire up this type's slider row
          if (mosaics.length > 0) {
            setupSliderRow(type, mosaics);
          }
          // Show the control bar once at least one catalog loads
          document.getElementById("timeControlBar").classList.add("visible");
        })
        .catch(function(e) {
          if (listEl) listEl.innerHTML = '<div class="lp-loading">Error: ' + e.message + '</div>';
          var loadEl = document.getElementById("tc-loading-" + type);
          if (loadEl) loadEl.textContent = "Error loading";
        });
    }

    function setupSliderRow(type, mosaics) {
      var range = document.getElementById("tc-range-" + type);
      var dateEl = document.getElementById("tc-date-" + type);
      var loadingEl = document.getElementById("tc-loading-" + type);
      range.min = "0";
      range.max = String(mosaics.length - 1);
      range.value = String(mosaics.length - 1);  // start at latest
      var latestLabel = mosaicLabel(mosaics[mosaics.length - 1]);
      dateEl.textContent = latestLabel;
      // Swap loading → slider + date
      loadingEl.style.display = "none";
      range.style.display = "";
      dateEl.style.display = "";
      // Update headline if this is the active type
      if (type === activeSliderType) {
        document.getElementById("tcActiveDate").textContent = latestLabel;
      }
    }

    function onSliderInput(type, val) {
      var mosaics = planetMosaics[type];
      if (!mosaics || !mosaics.length) return;
      var idx = parseInt(val, 10);
      var name = mosaics[idx];
      var label = mosaicLabel(name);
      document.getElementById("tc-date-" + type).textContent = label;
      // Make this the active slider visually and in control
      setActiveSlider(type);
      // Ensure basemap entry exists
      if (!BASEMAPS[name]) {
        BASEMAPS[name] = { url: planetTileUrl(name), maxZoom: 18, attr: "Planet Labs" };
      }
      // Swap active time layer — add new FIRST so tiles start loading before old is removed
      var prevLayer = activeTimeLayer;
      if (!activeLayers[name]) {
        addLayer(name);
      }
      activeTimeLayer = name;
      if (prevLayer && prevLayer !== name) {
        // Delay removal so new tiles load before old layer disappears
        setTimeout(function() { removeLayerByName(prevLayer); }, 800);
      }
    }

    // Preserve old name for any callers in initial mosaic setup
    function onTimeSlide(val) { onSliderInput(activeSliderType, val); }

    // --- Play / animate ---
    function togglePlay() {
      var btn = document.getElementById("tcPlayBtn");
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        btn.innerHTML = "&#9654;";
        btn.classList.remove("playing");
        return;
      }
      btn.innerHTML = "&#9646;&#9646;";
      btn.classList.add("playing");
      playInterval = setInterval(function() {
        var type = activeSliderType;
        var mosaics = planetMosaics[type];
        if (!mosaics || !mosaics.length) return;
        var range = document.getElementById("tc-range-" + type);
        var next = (parseInt(range.value, 10) + 1) % mosaics.length;
        range.value = String(next);
        onSliderInput(type, String(next));
      }, 600);
    }

    // --- Create viewer ---
    var viewer = new Cesium.Viewer("cesiumContainer", {
      animation: false, timeline: false, fullscreenButton: false,
      homeButton: false, geocoder: false, navigationHelpButton: false,
      sceneModePicker: false, baseLayerPicker: false,
      selectionIndicator: false, infoBox: false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
      baseLayer: false,
    });

    // Initial layers
    addLayer("Esri Ocean");
    ${params.tileUrl && params.tileAttribution.includes("Planet") ? `
    var initialMosaic = ${JSON.stringify(params.tileAttribution.replace("Planet Labs — ", ""))};
    BASEMAPS[initialMosaic] = { url: planetTileUrl(initialMosaic), maxZoom: 18, attr: "Planet Labs" };
    addLayer(initialMosaic);
    activeTimeLayer = initialMosaic;
    ` : `${params.tileUrl ? `
    BASEMAPS["Custom"] = { url: ${JSON.stringify(params.tileUrl)}, maxZoom: 18, attr: ${JSON.stringify(params.tileAttribution)} };
    addLayer("Custom");
    ` : ""}`}

    // Auto-load Planet catalogs
    if (PLANET_API_KEY) {
      loadPlanetCatalog("monthly");
      loadPlanetCatalog("quarterly");
    }

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
    var oceanEntry = activeLayers["Esri Ocean"];
    if (oceanEntry) { oceanEntry.layer.brightness = 0.8; oceanEntry.layer.contrast = 1.15; }

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
    // Exponential spin speed: 0 → 0.0003x, ~33 → 1x, 100 → 4000x
    var spinSpeed = 0.002;
    function setSpinSpeed(val) {
      var t = val / 100; // 0..1
      // 0.0000006 at t=0, 0.002 at t≈0.33, 8.0 at t=1
      spinSpeed = 0.0000006 * Math.pow(13333333, t);
      var mult = spinSpeed / 0.002;
      var label;
      if (mult < 0.01) label = mult.toFixed(4) + "x";
      else if (mult < 0.1) label = mult.toFixed(3) + "x";
      else if (mult < 1) label = mult.toFixed(2) + "x";
      else if (mult < 10) label = mult.toFixed(1) + "x";
      else label = Math.round(mult) + "x";
      document.getElementById("speedLabel").textContent = label;
    }
    setSpinSpeed(33); // init to ~1x
    function spinGlobe() {
      if (!rotating) return;
      viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -spinSpeed);
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
      document.getElementById("spinSpeedCtrl").style.display = rotating ? "" : "none";
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

    // Track cursor position on globe
    var coordsEl = document.getElementById("coords");
    handler.setInputAction(function(movement) {
      var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        var carto = Cesium.Cartographic.fromCartesian(cartesian);
        var lat = Cesium.Math.toDegrees(carto.latitude);
        var lng = Cesium.Math.toDegrees(carto.longitude);
        coordsEl.textContent = lat.toFixed(4) + ", " + lng.toFixed(4);
        coordsEl.classList.add("tracking");
      } else {
        coordsEl.classList.remove("tracking");
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Update provider list whenever layers change
    function updateProviderList() {
      var providers = layerOrder
        .filter(function(n) { return activeLayers[n] && activeLayers[n].visible && BASEMAPS[n]; })
        .map(function(n) { return BASEMAPS[n].attr; });
      // Deduplicate
      var seen = {};
      var unique = providers.filter(function(p) { if (seen[p]) return false; seen[p] = true; return true; });
      document.getElementById("providerList").textContent = unique.join(" · ");
    }
    // Patch renderStack to also update providers
    var _origRenderStack = renderStack;
    renderStack = function() { _origRenderStack(); updateProviderList(); };
    updateProviderList();
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
        .default("Gearon's Globe Emporium")
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

      const port = 8765;
      const url = serveAndOpen(params.output_path, port);

      return {
        content: [
          {
            type: "text" as const,
            text: `Interactive 3D globe written to ${params.output_path}\nServing at ${url}\n\nFeatures:\n- Basemap: ${params.basemap}${mosaicInfo}\n- CesiumJS with Cesium World Terrain (real 3D elevation)\n- Terrain exaggeration: ${params.terrain_exaggeration}x\n- ${params.auto_rotate ? "Auto-spin (click to stop)" : "No auto-spin"}\n- Spin / Reset / Terrain toggle buttons\n${params.geojson_path ? "- GeoJSON overlay from " + params.geojson_path + "\n" : ""}${params.geojson_url ? "- GeoJSON overlay from URL\n" : ""}`,
          },
        ],
      };
    },
  );
}
