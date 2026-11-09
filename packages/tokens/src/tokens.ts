import { oklchToHex } from './color.ts';

export type Mode = 'light' | 'dark';
export type Appearance = 'soft' | 'flat';

export interface ColorSet {
  surface: string;
  well: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
  warning: string;
  outline: string;
  shadowDark: string;
  shadowDarker: string;
  shadowLight: string;
  /** Soft style only: the plastic body of knobs and buttons. */
  knobTop: string;
  knobBottom: string;
  /** Recessed surface in the soft style. */
  wellSoft: string;
  /** Gradient for accent surfaces that carry text. */
  loudTop: string;
  loudBottom: string;
  /** Brighter gradient for accent surfaces without text. */
  fillTop: string;
  fillBottom: string;
  /** Indicator dot of the dial. */
  heat: string;
  /** A light that is on. */
  glow: string;
}

export const colors: Record<Mode, ColorSet> = {
  light: {
    surface: 'oklch(.975 0 0)',
    well: 'oklch(.93 0 0)',
    text: 'oklch(.38 0 0)',
    textMuted: 'oklch(.50 0 0)',
    accent: 'oklch(.50 .14 145)',
    onAccent: 'oklch(.99 0 0)',
    danger: 'oklch(.52 .19 25)',
    warning: 'oklch(.52 .11 75)',
    outline: 'oklch(.60 0 0)',
    shadowDark: 'oklch(.85 0 0)',
    shadowDarker: 'oklch(.72 0 0)',
    shadowLight: 'oklch(1 0 0)',
    knobTop: 'oklch(.975 0 0)',
    knobBottom: 'oklch(.93 0 0)',
    wellSoft: 'oklch(1 0 0)',
    loudTop: 'oklch(.54 .14 145)',
    loudBottom: 'oklch(.46 .13 145)',
    fillTop: 'oklch(.70 .15 145)',
    fillBottom: 'oklch(.58 .14 145)',
    heat: 'oklch(.70 .17 45)',
    glow: 'oklch(.75 .15 75)',
  },
  dark: {
    surface: 'oklch(.27 0 0)',
    well: 'oklch(.22 0 0)',
    text: 'oklch(.93 0 0)',
    textMuted: 'oklch(.74 0 0)',
    accent: 'oklch(.78 .15 145)',
    onAccent: 'oklch(.22 0 0)',
    danger: 'oklch(.74 .15 25)',
    warning: 'oklch(.82 .14 75)',
    outline: 'oklch(.60 0 0)',
    shadowDark: 'oklch(.18 0 0)',
    shadowDarker: 'oklch(.14 0 0)',
    shadowLight: 'oklch(.34 0 0)',
    knobTop: 'oklch(.33 0 0)',
    knobBottom: 'oklch(.26 0 0)',
    wellSoft: 'oklch(.22 0 0)',
    loudTop: 'oklch(.82 .15 145)',
    loudBottom: 'oklch(.74 .15 145)',
    fillTop: 'oklch(.80 .15 145)',
    fillBottom: 'oklch(.70 .15 145)',
    heat: 'oklch(.74 .16 45)',
    glow: 'oklch(.82 .14 75)',
  },
};

/**
 * HA 2026.9.4 draws buttons, radios and links from this scale, not from `primary-color`.
 * One scale serves both modes: HA reads 40, 50, 90, 95 in light mode and 40, 60, 70, 05, 10 in
 * dark mode, and always puts white text on 40. The lightness jump between 50 and 60 follows from that.
 */
export const primaryScale = {
  '05': 'oklch(.20 .04 145)',
  '10': 'oklch(.26 .06 145)',
  '20': 'oklch(.32 .09 145)',
  '30': 'oklch(.39 .11 145)',
  '40': 'oklch(.46 .13 145)',
  '50': 'oklch(.50 .14 145)',
  '60': 'oklch(.72 .15 145)',
  '70': 'oklch(.78 .15 145)',
  '80': 'oklch(.84 .11 145)',
  '90': 'oklch(.93 .04 145)',
  '95': 'oklch(.97 .02 145)',
} as const;

/**
 * Light mode only: HA derives its state colors from these base colors and also uses them as text.
 * Amber, yellow and lime stay as they are, they mostly signal "light on" and would turn brown.
 */
export const lightStateColors = {
  'red-color': 'oklch(.52 .19 25)',
  'pink-color': 'oklch(.52 .19 5)',
  'purple-color': 'oklch(.50 .15 305)',
  'deep-purple-color': 'oklch(.46 .15 295)',
  'indigo-color': 'oklch(.46 .13 275)',
  'blue-color': 'oklch(.50 .15 255)',
  'light-blue-color': 'oklch(.50 .11 240)',
  'cyan-color': 'oklch(.50 .085 215)',
  'teal-color': 'oklch(.50 .085 185)',
  'green-color': 'oklch(.50 .14 145)',
  'light-green-color': 'oklch(.50 .13 130)',
  'orange-color': 'oklch(.52 .12 65)',
  'deep-orange-color': 'oklch(.52 .16 45)',
  'brown-color': 'oklch(.46 .07 50)',
  'grey-color': 'oklch(.52 0 0)',
  'blue-grey-color': 'oklch(.50 .04 240)',
  'state-climate-heat-cool-color': 'oklch(.52 .12 65)',
} as const;

export const radius = { card: '26px', control: '20px', pill: '999px' } as const;
export const space = { unit: '4px', card: '20px' } as const;
export const motion = { duration: '200ms' } as const;
export const target = { min: '44px' } as const;

const hex = (mode: Mode, key: keyof ColorSet): string => oklchToHex(colors[mode][key]);

const raisedShadow = (mode: Mode): string =>
  `10px 10px 22px ${hex(mode, 'shadowDark')}, -10px -10px 22px ${hex(mode, 'shadowLight')}`;

const insetShadow = (mode: Mode): string => `inset 0 6px 12px ${hex(mode, 'shadowDark')}`;
const trackShadow = (mode: Mode): string => `inset 0 2px 4px ${hex(mode, 'shadowDarker')}`;
const pressedShadow = (mode: Mode): string => `inset 0 3px 6px ${hex(mode, 'shadowDarker')}`;
const knobShadow = (mode: Mode): string =>
  `0 4px 8px ${hex(mode, 'shadowDarker')}, inset 0 2px 3px ${hex(mode, 'shadowLight')}`;

const FONT_STACK = 'Manrope, Roboto, Noto, sans-serif';

/** Variables of the Home Assistant theme. Names are CSS variables without the leading dashes. */
export function themeVariables(mode: Mode): Record<string, string> {
  return {
    'primary-color': hex(mode, 'accent'),
    'accent-color': hex(mode, 'accent'),
    'primary-text-color': hex(mode, 'text'),
    'secondary-text-color': hex(mode, 'textMuted'),
    'text-primary-color': hex(mode, 'onAccent'),
    'primary-background-color': hex(mode, 'surface'),
    'lovelace-background': hex(mode, 'surface'),
    'card-background-color': hex(mode, 'surface'),
    'ha-card-background': hex(mode, 'surface'),
    'error-color': hex(mode, 'danger'),
    'warning-color': hex(mode, 'warning'),
    'ha-card-border-radius': radius.card,
    'ha-card-border-width': '0px',
    'ha-card-box-shadow': raisedShadow(mode),
    'ha-font-family-body': FONT_STACK,
    'octa-theme-well': hex(mode, 'well'),
    'octa-theme-well-soft': hex(mode, 'wellSoft'),
    'octa-theme-outline': hex(mode, 'outline'),
    'octa-theme-control-edge': `color-mix(in oklab, ${hex(mode, 'shadowLight')} 60%, transparent)`,
    'octa-theme-shade-light': hex(mode, 'shadowLight'),
    'octa-theme-shade-dark': hex(mode, 'shadowDark'),
    'octa-theme-shade-darker': hex(mode, 'shadowDarker'),
    'octa-theme-shadow-raised': raisedShadow(mode),
    'octa-theme-shadow-inset': insetShadow(mode),
    'octa-theme-shadow-track': trackShadow(mode),
    'octa-theme-shadow-pressed': pressedShadow(mode),
    'octa-theme-shadow-knob': knobShadow(mode),
    'octa-theme-knob-top': hex(mode, 'knobTop'),
    'octa-theme-knob-bottom': hex(mode, 'knobBottom'),
    'octa-theme-loud-top': hex(mode, 'loudTop'),
    'octa-theme-loud-bottom': hex(mode, 'loudBottom'),
    'octa-theme-fill-top': hex(mode, 'fillTop'),
    'octa-theme-fill-bottom': hex(mode, 'fillBottom'),
    'octa-theme-heat': hex(mode, 'heat'),
    'octa-theme-glow': hex(mode, 'glow'),
    ...Object.fromEntries(
      Object.entries(primaryScale).map(([step, color]) => [`ha-color-primary-${step}`, oklchToHex(color)]),
    ),
    ...(mode === 'light'
      ? Object.fromEntries(Object.entries(lightStateColors).map(([name, color]) => [name, oklchToHex(color)]))
      : {}),
  };
}

/**
 * Semantic layer for component styles. Precedence: active HA theme, then Octa Home UI defaults.
 * `well` and `outline` have no HA counterpart, so they derive from the active surface and stay
 * correct under foreign themes.
 */
export function tokensCss(): string {
  const base = colors.light;
  return `:host {
  --octa-surface: var(--ha-card-background, var(--card-background-color, ${base.surface}));
  --octa-text: var(--primary-text-color, ${base.text});
  --octa-text-muted: var(--secondary-text-color, ${base.textMuted});
  --octa-accent: var(--primary-color, ${base.accent});
  --octa-on-accent: var(--text-primary-color, ${base.onAccent});
  --octa-danger: var(--error-color, ${base.danger});
  --octa-warning: var(--warning-color, ${base.warning});
  --octa-well: var(--octa-theme-well, color-mix(in oklab, var(--octa-text) 10%, var(--octa-surface)));
  --octa-outline: var(--octa-theme-outline, color-mix(in oklab, var(--octa-text) 55%, var(--octa-surface)));
  --octa-shadow-raised: var(--octa-theme-shadow-raised, 0 1px 3px rgb(0 0 0 / 0.25));
  --octa-shadow-inset: var(--octa-theme-shadow-inset, inset 0 1px 3px rgb(0 0 0 / 0.25));
  --octa-shadow-track: var(--octa-theme-shadow-track, inset 0 1px 2px rgb(0 0 0 / 0.25));
  --octa-shadow-pressed: var(--octa-theme-shadow-pressed, inset 0 1px 3px rgb(0 0 0 / 0.3));
  --octa-shadow-knob: var(--octa-theme-shadow-knob, 0 1px 3px rgb(0 0 0 / 0.3));
  --octa-shade-light: var(--octa-theme-shade-light, rgb(255 255 255 / 0.4));
  --octa-shade-dark: var(--octa-theme-shade-dark, rgb(0 0 0 / 0.15));
  --octa-shade-darker: var(--octa-theme-shade-darker, rgb(0 0 0 / 0.3));
  --octa-well-soft: var(--octa-theme-well-soft, var(--octa-well));
  --octa-edge: var(--octa-theme-control-edge, var(--octa-outline));
  --octa-knob-top: var(--octa-theme-knob-top, var(--octa-surface));
  --octa-knob-bottom: var(--octa-theme-knob-bottom, var(--octa-well));
  --octa-knob: linear-gradient(180deg, var(--octa-knob-top), var(--octa-knob-bottom));
  --octa-loud: linear-gradient(180deg, var(--octa-theme-loud-top, var(--octa-accent)), var(--octa-theme-loud-bottom, var(--octa-accent)));
  --octa-fill-top: var(--octa-theme-fill-top, var(--octa-accent));
  --octa-fill-bottom: var(--octa-theme-fill-bottom, var(--octa-accent));
  --octa-fill: linear-gradient(180deg, var(--octa-fill-top), var(--octa-fill-bottom));
  --octa-heat: var(--octa-theme-heat, var(--octa-warning));
  --octa-radius-card: ${radius.card};
  --octa-radius-control: ${radius.control};
  --octa-radius-pill: ${radius.pill};
  --octa-space: ${space.unit};
  --octa-space-card: ${space.card};
  --octa-target: ${target.min};
  --octa-duration: ${motion.duration};
}
@media (prefers-reduced-motion: reduce) {
  :host { --octa-duration: 0ms; }
}`;
}

export function themeYaml(name = 'Octa Home UI'): string {
  const block = (mode: Mode): string =>
    Object.entries(themeVariables(mode))
      .map(([key, value]) => `      ${key}: "${value}"`)
      .join('\n');
  return `${name}:\n  modes:\n    light:\n${block('light')}\n    dark:\n${block('dark')}\n`;
}
