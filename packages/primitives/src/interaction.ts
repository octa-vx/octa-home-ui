/** Framework-free value and drag logic, shared by slider and dial. */

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function snap(value: number, min: number, max: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const snapped = min + Math.round((value - min) / step) * step;
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

export const ratioOf = (value: number, min: number, max: number): number =>
  max === min ? 0 : clamp((value - min) / (max - min), 0, 1);

export const valueFromRatio = (ratio: number, min: number, max: number, step: number): number =>
  snap(min + clamp(ratio, 0, 1) * (max - min), min, max, step);

export const DIAL_START = 135;
export const DIAL_SWEEP = 270;

/** Maps a screen angle in degrees to the arc position. Angles in the bottom gap go to the nearest end. */
export function ratioFromAngle(angle: number): number {
  const offset = (((angle - DIAL_START) % 360) + 360) % 360;
  if (offset <= DIAL_SWEEP) return offset / DIAL_SWEEP;
  return offset - DIAL_SWEEP < (360 - DIAL_SWEEP) / 2 ? 1 : 0;
}

export function angleFromPoint(centerX: number, centerY: number, x: number, y: number): number {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}

/** Rejects a jump across the bottom gap, which would flip the dial between minimum and maximum. */
export const isWrapJump = (previous: number, next: number): boolean => Math.abs(next - previous) > 0.5;

export function polarPoint(radius: number, angle: number, center = 100): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
}

export function arcPath(radius: number, startAngle: number, endAngle: number): string {
  const [startX, startY] = polarPoint(radius, startAngle);
  const [endX, endY] = polarPoint(radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

/**
 * Keeps the user's value on screen while dragging and just after release.
 * Incoming states cannot move the control during a drag. After release the local value holds until
 * the device reports it or the hold time runs out, which prevents a visible jump back.
 */
export class ValueHold {
  private local: number | undefined;
  private dragging = false;
  private holdUntil = 0;

  constructor(
    readonly holdMs = 1500,
    private readonly tolerance = 0,
  ) {}

  get active(): boolean {
    return this.dragging;
  }

  begin(value: number): void {
    this.dragging = true;
    this.local = value;
  }

  move(value: number): void {
    if (this.dragging) this.local = value;
  }

  end(now: number): void {
    this.dragging = false;
    this.holdUntil = now + this.holdMs;
  }

  cancel(): void {
    this.dragging = false;
    this.local = undefined;
  }

  read(external: number, now: number): number {
    if (this.local === undefined) return external;
    if (this.dragging) return this.local;
    if (Math.abs(external - this.local) <= this.tolerance || now >= this.holdUntil) {
      this.local = undefined;
      return external;
    }
    return this.local;
  }
}

/** Leading and trailing throttle. `cancel` drops a pending trailing call. */
export function throttle<A extends unknown[]>(run: (...args: A) => void, waitMs: number) {
  let last = -Infinity;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;

  const fire = (args: A): void => {
    last = Date.now();
    pending = undefined;
    run(...args);
  };

  const call = (...args: A): void => {
    const remaining = waitMs - (Date.now() - last);
    if (remaining <= 0 && timer === undefined) {
      fire(args);
      return;
    }
    pending = args;
    timer ??= setTimeout(() => {
      timer = undefined;
      if (pending) fire(pending);
    }, Math.max(0, remaining));
  };

  call.cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  return call;
}
