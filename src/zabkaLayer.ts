import L, { type LatLngExpression, type LayerGroup, type Map as LeafletMap } from "leaflet";
import { isLatLngInsideAllPolygons } from "./geoClip";

interface ZabkaPoint {
  lat: number;
  lng: number;
  score: number;
}

export interface ZabkaStoreClickPayload {
  storeId: string;
  label: string;
  index: number;
  lat: number;
  lng: number;
  score: number;
}

interface ZabkaCoverageHub {
  lat: number;
  lng: number;
  label: string;
  coverage: number;
}

type ZabkaMode = "national" | "warsaw" | "city";

interface ZabkaLayerOptions {
  center?: LatLngExpression;
  cityId?: string;
  populationK?: number;
  clipPolygon?: LatLngExpression[];
  clipPolygons?: LatLngExpression[][];
}

type StarSpriteKind = "normal" | "strong" | "hot";

interface StarSprite {
  canvas: HTMLCanvasElement;
  size: number;
}

function pseudoRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function visibleStoreCode(seed: number, digits = 4): string {
  const random = pseudoRandom(seed || 20260617);
  return Array.from({ length: digits }, () => String(Math.floor(random() * 9) + 1)).join("");
}

function zabkaLoreName(seed: number, zone?: string): string {
  const random = pseudoRandom(seed || 20260617);
  const prefixes = ["Verdant", "Vistula", "Neon", "Pilgrim", "Market", "Night", "Amber", "Fresh", "Signal", "Metro", "Iron", "Saint"];
  const nouns = ["Gate", "Reliquary", "Bastion", "Lantern", "Depot", "Shrine", "Outpost", "Circuit", "Forge", "Cantina", "Anchor", "Vault"];
  const prefix = prefixes[Math.floor(random() * prefixes.length)];
  const noun = nouns[Math.floor(random() * nouns.length)];
  return `Żabka ${prefix} ${noun}${zone ? ` / ${zone}` : ""}`;
}

function zabkaStarZoomScale(zoom: number): number {
  return Math.min(1.55, Math.max(0.72, 0.82 + (zoom - 8.75) * 0.12));
}

function drawStarPath(context: CanvasRenderingContext2D, x: number, y: number, outerRadius: number): void {
  const innerRadius = outerRadius * 0.43;
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

class ZabkaStoreStarCanvasLayer extends L.Layer {
  private mapInstance: LeafletMap | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private frame = 0;
  private spriteKey = "";
  private sprites: Record<StarSpriteKind, StarSprite> | null = null;
  private selectedIndex: number | null = null;
  private readonly points: Array<ZabkaPoint & { index: number; latLng: L.LatLng }>;

  constructor(points: ZabkaPoint[]) {
    super();
    this.points = points.map((point, index) => ({
      ...point,
      index,
      latLng: L.latLng(point.lat, point.lng)
    }));
  }

  onAdd(map: LeafletMap): this {
    this.mapInstance = map;
    this.canvas = L.DomUtil.create("canvas", "zabka-store-star-canvas") as HTMLCanvasElement;
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.zIndex = "525";
    map.getPanes().markerPane.appendChild(this.canvas);
    map.on("move zoom zoomend moveend viewreset resize", this.scheduleDraw, this);
    map.on("click", this.handleClick, this);
    map.on("mousemove", this.handlePointerMove, this);
    this.draw();
    return this;
  }

  onRemove(map: LeafletMap): this {
    map.off("move zoom zoomend moveend viewreset resize", this.scheduleDraw, this);
    map.off("click", this.handleClick, this);
    map.off("mousemove", this.handlePointerMove, this);
    map.getContainer().classList.remove("zabka-store-hover");
    if (this.frame) {
      window.cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.mapInstance = null;
    return this;
  }

  private scheduleDraw(): void {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    const map = this.mapInstance;
    const canvas = this.canvas;
    if (!map || !canvas) return;

    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(size.x * pixelRatio));
    const height = Math.max(1, Math.round(size.y * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    }
    L.DomUtil.setPosition(canvas, topLeft);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    context.globalCompositeOperation = "lighter";

    const visibleBounds = map.getBounds().pad(0.18);
    const zoom = map.getZoom();
    const scale = zabkaStarZoomScale(zoom);
    const sprites = this.getSprites(scale, pixelRatio);
    const margin = 18 * scale;

    this.points.forEach((point) => {
      if (!visibleBounds.contains(point.latLng)) return;
      const layerPoint = map.latLngToLayerPoint(point.latLng);
      const x = layerPoint.x - topLeft.x;
      const y = layerPoint.y - topLeft.y;
      if (x < -margin || y < -margin || x > size.x + margin || y > size.y + margin) return;

      const hot = point.score > 0.93;
      const strong = point.score > 0.78;
      const sprite = hot ? sprites.hot : strong ? sprites.strong : sprites.normal;
      if (this.selectedIndex === point.index) {
        const radius = (hot ? 8.2 : strong ? 7.2 : 6.4) * scale;
        context.save();
        context.shadowBlur = 14;
        context.shadowColor = "rgba(255, 247, 199, 0.86)";
        context.strokeStyle = "rgba(255, 247, 199, 0.92)";
        context.lineWidth = 1.6;
        drawStarPath(context, x, y, radius);
        context.stroke();
        context.restore();
      }
      context.drawImage(sprite.canvas, x - sprite.size / 2, y - sprite.size / 2, sprite.size, sprite.size);
    });

    context.globalCompositeOperation = "source-over";
  }

  private handleClick(event: L.LeafletMouseEvent): void {
    const map = this.mapInstance;
    if (!map) return;

    const point = this.hitTest(event.latlng);
    if (!point) return;

    this.selectedIndex = point.index;
    this.scheduleDraw();
    map.fire("zabka-store-click", this.pointPayload(point));
    L.DomEvent.stop(event.originalEvent);
  }

  private handlePointerMove(event: L.LeafletMouseEvent): void {
    const map = this.mapInstance;
    if (!map) return;
    map.getContainer().classList.toggle("zabka-store-hover", Boolean(this.hitTest(event.latlng)));
  }

  private hitTest(latLng: L.LatLng): (ZabkaPoint & { index: number; latLng: L.LatLng }) | null {
    const map = this.mapInstance;
    if (!map) return null;

    const clickPoint = map.latLngToLayerPoint(latLng);
    const visibleBounds = map.getBounds().pad(0.08);
    const scale = zabkaStarZoomScale(map.getZoom());
    const threshold = 13 * scale;
    const thresholdSq = threshold * threshold;
    let closest: (ZabkaPoint & { index: number; latLng: L.LatLng }) | null = null;
    let closestDistanceSq = thresholdSq;

    this.points.forEach((point) => {
      if (!visibleBounds.contains(point.latLng)) return;
      const layerPoint = map.latLngToLayerPoint(point.latLng);
      const dx = layerPoint.x - clickPoint.x;
      const dy = layerPoint.y - clickPoint.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= closestDistanceSq) {
        closest = point;
        closestDistanceSq = distanceSq;
      }
    });

    return closest;
  }

  private pointPayload(point: ZabkaPoint & { index: number }): ZabkaStoreClickPayload {
    const seed = (point.index + 1) * 7919 + Math.round(point.score * 100000);
    const number = visibleStoreCode(seed, 4);
    return {
      storeId: `zabka-store-${number}`,
      label: zabkaLoreName(seed),
      index: point.index,
      lat: point.lat,
      lng: point.lng,
      score: point.score
    };
  }

  private getSprites(scale: number, pixelRatio: number): Record<StarSpriteKind, StarSprite> {
    const key = `${scale.toFixed(3)}:${pixelRatio.toFixed(2)}`;
    if (this.sprites && this.spriteKey === key) return this.sprites;

    this.spriteKey = key;
    this.sprites = {
      normal: this.createSprite("normal", scale, pixelRatio),
      strong: this.createSprite("strong", scale, pixelRatio),
      hot: this.createSprite("hot", scale, pixelRatio)
    };
    return this.sprites;
  }

  private createSprite(kind: StarSpriteKind, scale: number, pixelRatio: number): StarSprite {
    const radius = (kind === "hot" ? 5.6 : kind === "strong" ? 4.4 : 3.2) * scale;
    const glow = kind === "hot" ? 11 : kind === "strong" ? 7 : 4;
    const size = Math.ceil((radius + glow + 2) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(size * pixelRatio));
    canvas.height = Math.max(1, Math.round(size * pixelRatio));

    const context = canvas.getContext("2d");
    if (!context) return { canvas, size };

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const center = size / 2;
    context.shadowBlur = glow;
    context.shadowColor = kind === "hot"
      ? "rgba(255, 57, 88, 0.82)"
      : kind === "strong"
        ? "rgba(219, 255, 62, 0.58)"
        : "rgba(76, 255, 108, 0.46)";
    context.fillStyle = kind === "hot"
      ? "rgba(255, 55, 88, 0.94)"
      : kind === "strong"
        ? "rgba(222, 255, 67, 0.84)"
        : "rgba(77, 255, 104, 0.68)";
    drawStarPath(context, center, center, radius);
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(255, 246, 215, 0.8)";
    drawStarPath(context, center, center, radius * 0.36);
    context.fill();

    return { canvas, size };
  }
}

export function createZabkaLayer(
  map: LeafletMap,
  count = 2400,
  mode: ZabkaMode = "national",
  options: ZabkaLayerOptions = {}
): LayerGroup {
  const center = options.center ? L.latLng(options.center) : L.latLng(52.23, 21.01);
  const seedOffset = [...(options.cityId ?? mode)].reduce((acc, char) => acc + char.charCodeAt(0) * 97, 0);
  const random = pseudoRandom(20260617 + seedOffset);
  const layers: L.Layer[] = [];

  const nationalClusters = [
    { lat: 52.23, lng: 21.01, spreadLat: 0.22, spreadLng: 0.34, weight: 0.38 },
    { lat: 50.06, lng: 19.94, spreadLat: 0.15, spreadLng: 0.24, weight: 0.18 },
    { lat: 51.77, lng: 19.46, spreadLat: 0.16, spreadLng: 0.26, weight: 0.14 },
    { lat: 51.11, lng: 17.03, spreadLat: 0.14, spreadLng: 0.24, weight: 0.12 },
    { lat: 52.41, lng: 16.93, spreadLat: 0.13, spreadLng: 0.22, weight: 0.1 },
    { lat: 54.35, lng: 18.65, spreadLat: 0.12, spreadLng: 0.22, weight: 0.08 }
  ];

  const warsawClusters = [
    { lat: 52.23, lng: 21.01, spreadLat: 0.055, spreadLng: 0.075, weight: 0.34 },
    { lat: 52.18, lng: 21.02, spreadLat: 0.04, spreadLng: 0.065, weight: 0.18 },
    { lat: 52.25, lng: 21.08, spreadLat: 0.045, spreadLng: 0.06, weight: 0.16 },
    { lat: 52.27, lng: 20.95, spreadLat: 0.044, spreadLng: 0.062, weight: 0.14 },
    { lat: 52.14, lng: 21.06, spreadLat: 0.038, spreadLng: 0.058, weight: 0.1 },
    { lat: 52.31, lng: 20.99, spreadLat: 0.036, spreadLng: 0.052, weight: 0.08 }
  ];

  const citySpread = Math.min(0.082, Math.max(0.034, Math.sqrt(options.populationK ?? 240) * 0.0027));
  const selectedCityClusters = [
    { lat: center.lat, lng: center.lng, spreadLat: citySpread * 0.78, spreadLng: citySpread * 1.08, weight: 0.34 },
    { lat: center.lat - citySpread * 0.78, lng: center.lng + citySpread * 0.2, spreadLat: citySpread * 0.56, spreadLng: citySpread * 0.94, weight: 0.18 },
    { lat: center.lat + citySpread * 0.42, lng: center.lng + citySpread * 0.84, spreadLat: citySpread * 0.62, spreadLng: citySpread * 0.86, weight: 0.16 },
    { lat: center.lat + citySpread * 0.66, lng: center.lng - citySpread * 0.72, spreadLat: citySpread * 0.62, spreadLng: citySpread * 0.9, weight: 0.14 },
    { lat: center.lat - citySpread * 1.18, lng: center.lng + citySpread * 0.56, spreadLat: citySpread * 0.52, spreadLng: citySpread * 0.8, weight: 0.1 },
    { lat: center.lat + citySpread * 1.18, lng: center.lng - citySpread * 0.18, spreadLat: citySpread * 0.48, spreadLng: citySpread * 0.72, weight: 0.08 }
  ];

  const cityCoverageHubs: ZabkaCoverageHub[] = [
    { lat: center.lat + citySpread * 0.02, lng: center.lng + citySpread * 0.02, label: "Core", coverage: 94 },
    { lat: center.lat - citySpread * 0.72, lng: center.lng + citySpread * 0.24, label: "South", coverage: 86 },
    { lat: center.lat + citySpread * 0.45, lng: center.lng + citySpread * 0.86, label: "East", coverage: 82 },
    { lat: center.lat + citySpread * 0.68, lng: center.lng - citySpread * 0.68, label: "West", coverage: 79 },
    { lat: center.lat - citySpread * 1.12, lng: center.lng + citySpread * 0.58, label: "Outer", coverage: 74 },
    { lat: center.lat + citySpread * 1.08, lng: center.lng - citySpread * 0.18, label: "North", coverage: 71 }
  ];

  const warsawCoverageHubs: ZabkaCoverageHub[] = [
    { lat: 52.232, lng: 21.012, label: "Central", coverage: 96 },
    { lat: 52.184, lng: 21.026, label: "Mokotow", coverage: 88 },
    { lat: 52.252, lng: 21.085, label: "Praga", coverage: 84 },
    { lat: 52.273, lng: 20.952, label: "Wola", coverage: 81 },
    { lat: 52.142, lng: 21.061, label: "Ursynow", coverage: 76 },
    { lat: 52.314, lng: 20.992, label: "Bielany", coverage: 72 }
  ];

  const clusters = mode === "national" ? nationalClusters : mode === "warsaw" ? warsawClusters : selectedCityClusters;
  const coverageHubs = mode === "warsaw" ? warsawCoverageHubs : cityCoverageHubs;

  function pickCluster() {
    const roll = random();
    let cursor = 0;
    return clusters.find((cluster) => {
      cursor += cluster.weight;
      return roll <= cursor;
    }) ?? clusters[0];
  }

  function makePoint(): ZabkaPoint {
    const cluster = pickCluster();
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    return {
      lat: cluster.lat + Math.sin(angle) * radius * cluster.spreadLat + (random() - 0.5) * 0.022,
      lng: cluster.lng + Math.cos(angle) * radius * cluster.spreadLng + (random() - 0.5) * 0.028,
      score: random()
    };
  }

  function isInsideClip(latLng: LatLngExpression): boolean {
    const polygons = [
      ...(options.clipPolygon ? [options.clipPolygon] : []),
      ...(options.clipPolygons ?? [])
    ];
    return polygons.length === 0 || isLatLngInsideAllPolygons(latLng, polygons);
  }

  const storePoints: ZabkaPoint[] = [];
  const maxAttempts = Math.max(count * 24, count + 1);
  for (let attempts = 0; storePoints.length < count && attempts < maxAttempts; attempts += 1) {
    const point = makePoint();
    if (isInsideClip([point.lat, point.lng])) storePoints.push(point);
  }
  layers.push(new ZabkaStoreStarCanvasLayer(storePoints));

  if (mode !== "national") {
    coverageHubs.filter((hub) => isInsideClip([hub.lat, hub.lng])).forEach((hub, hubIndex) => {
      layers.push(L.marker([hub.lat, hub.lng], {
        interactive: false,
        pane: "markerPane",
        icon: L.divIcon({
          className: "zabka-coverage-hub",
          html: `
            <span class="zabka-logo-mark">Ż</span>
            <b>${hub.coverage}%</b>
          `,
          iconSize: [58, 34],
          iconAnchor: [12, 17]
        })
      }).bindTooltip(`${hub.label}: ${hub.coverage}% Zabka coverage`, {
        direction: "top",
        opacity: 0.95,
        className: "coverage-tooltip"
      }));
      const brandLat = hub.lat + 0.0024;
      const brandLng = hub.lng + 0.0046;
      const brandLatLng: LatLngExpression = [brandLat, brandLng];
      if (isInsideClip(brandLatLng)) {
        const brandPoint = {
          lat: brandLat,
          lng: brandLng,
          score: Math.min(0.98, Math.max(0.52, hub.coverage / 100))
        };
        const brandMarker = L.marker(brandLatLng, {
          interactive: true,
          pane: "markerPane",
          icon: L.divIcon({
            className: "zabka-brand-star-icon",
            html: `<span class="zabka-brand-star"></span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        });
        brandMarker.on("click", (event) => {
          L.DomEvent.stop(event.originalEvent);
          const seed = (count + hubIndex + 1) * 3571 + Math.round(hub.coverage * 97);
          map.fire("zabka-store-click", {
            storeId: `zabka-hub-${options.cityId ?? mode}-${hubIndex + 1}`,
            label: zabkaLoreName(seed, hub.label),
            index: count + hubIndex,
            ...brandPoint
          } satisfies ZabkaStoreClickPayload);
        });
        layers.push(brandMarker);
      }
    });
  }

  const group = L.layerGroup(layers);
  return group;
}
