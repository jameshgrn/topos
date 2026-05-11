# topos

A TypeScript monorepo for geospatial visualization — interactive globes with satellite tracking, D3/GDAL-based rendering tools, and Claude Code skills for geospatial workflows.

## Monorepo Packages

- **geo-renderer**: MCP server providing D3 SVG map generation, locator globe rendering, and GDAL-based geoprocessing. Built with TypeScript, D3, and the MCP SDK.
- **geospatial-skills**: Markdown-based Claude Code skill documentation covering D3 cartography, GDAL commands, GeoParquet handling, and geospatial viewer integration.

## Rendered Globes

The repository includes several interactive CesiumJS-based globe visualizations:

- **globe.html**: "Gearon's Global Emporium" — base interactive globe with coordinate tracking
- **globe-satellites.html**: Real-time satellite tracker with ICESat-2 and Landsat 9 orbital paths
- **globe-timelapse.html**: Time-enabled globe with layer controls and animation
- **globe-bare.html**: Minimal globe setup
- **globe-test.html**, **globe2.html**: Development variants

All globes use CesiumJS 1.124 with satellite.js for TLE propagation, D3 for data visualization overlays, and Esri/NASA imagery layers.

## Additional Components

- **pantanal_figure.py**: Matplotlib-based figure generator for multi-sensor floodplain visualization (Sentinel-2, Sentinel-1 SAR, SWOT water-surface elevation, connectivity graphs)

## Tech Stack

- TypeScript 5.8, Node.js, CesiumJS 1.124, D3 v7
- Python 3.12, matplotlib, numpy, PIL for figure generation
- MCP SDK for server interface
- UV/npm for package management

## Status

Active development. The geo-renderer MCP server builds and passes type checks. Globe visualizations are functional with satellite tracking and layer management. The Pantanal figure generator produces publication-ready multi-panel visualizations. Main branch is protected — all work goes through feature branch PRs.

By Jake Gearon · [sandfrom.space](https://sandfrom.space)
