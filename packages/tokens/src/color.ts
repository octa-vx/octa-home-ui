/** Color math for token output and contrast checks. */

export type Rgb = readonly [number, number, number];

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

const gammaEncode = (linear: number): number =>
  linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;

const gammaDecode = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Converts `oklch(L C H)` to sRGB channels in the range 0..1. */
export function oklchToRgb(value: string): Rgb {
  const match = OKLCH.exec(value.trim());
  if (!match) throw new Error(`Not an oklch() color: ${value}`);
  const lightness = Number(match[1]);
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    clamp01(gammaEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(gammaEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(gammaEncode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

/** Home Assistant derives `rgb-*` variables from hex values, so themes must use hex. */
export function oklchToHex(value: string): string {
  const hex = oklchToRgb(value)
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * gammaDecode(r) + 0.7152 * gammaDecode(g) + 0.0722 * gammaDecode(b);
}

/** WCAG contrast ratio between two oklch() colors. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(oklchToRgb(first));
  const b = relativeLuminance(oklchToRgb(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
