import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { angleFromPoint, arcPath, clamp, isWrapJump, ratioFromAngle, ratioOf, snap, throttle, valueFromRatio, ValueHold } from './interaction.ts';

describe('value math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });

  it('snaps without float noise', () => {
    expect(snap(20.26, 5, 30, 0.1)).toBe(20.3);
    expect(snap(21.3, 5, 30, 0.5)).toBe(21.5);
    expect(snap(99.9, 0, 100, 1)).toBe(100);
  });

  it('snaps relative to the minimum', () => {
    expect(snap(7, 5, 30, 5)).toBe(5);
    expect(snap(8, 5, 30, 5)).toBe(10);
  });

  it('computes ratios safely', () => {
    expect(ratioOf(50, 0, 100)).toBe(0.5);
    expect(ratioOf(1, 1, 1)).toBe(0);
    expect(valueFromRatio(2, 0, 100, 1)).toBe(100);
  });
});

describe('dial geometry', () => {
  it('maps the arc ends and middle', () => {
    expect(ratioFromAngle(135)).toBe(0);
    expect(ratioFromAngle(45)).toBe(1);
    expect(ratioFromAngle(-90)).toBeCloseTo(0.5);
  });

  it('sends the bottom gap to the nearest end', () => {
    expect(ratioFromAngle(70)).toBe(1);
    expect(ratioFromAngle(110)).toBe(0);
  });

  it('computes screen angles', () => {
    expect(angleFromPoint(0, 0, 1, 0)).toBe(0);
    expect(angleFromPoint(0, 0, 0, -1)).toBe(-90);
  });

  it('detects jumps across the gap', () => {
    expect(isWrapJump(0.02, 0.98)).toBe(true);
    expect(isWrapJump(0.4, 0.45)).toBe(false);
  });

  it('flags long arcs', () => {
    expect(arcPath(80, 135, 405)).toContain(' 0 1 1 ');
    expect(arcPath(80, 135, 200)).toContain(' 0 0 1 ');
  });
});

describe('ValueHold', () => {
  it('passes the external value through when idle', () => {
    expect(new ValueHold().read(10, 0)).toBe(10);
  });

  it('ignores incoming states while dragging', () => {
    const hold = new ValueHold();
    hold.begin(40);
    hold.move(55);
    expect(hold.read(10, 100)).toBe(55);
    expect(hold.read(99, 200)).toBe(55);
  });

  it('holds the value after release until the device confirms it', () => {
    const hold = new ValueHold(1000);
    hold.begin(55);
    hold.end(0);
    expect(hold.read(10, 100)).toBe(55);
    expect(hold.read(55, 200)).toBe(55);
    expect(hold.read(12, 300)).toBe(12);
  });

  it('gives up after the hold time', () => {
    const hold = new ValueHold(1000);
    hold.begin(55);
    hold.end(0);
    expect(hold.read(10, 1000)).toBe(10);
  });

  it('accepts a confirmation within tolerance', () => {
    const hold = new ValueHold(1000, 1);
    hold.begin(55);
    hold.end(0);
    expect(hold.read(54, 100)).toBe(54);
  });

  it('reverts on cancel', () => {
    const hold = new ValueHold();
    hold.begin(55);
    hold.cancel();
    expect(hold.read(10, 0)).toBe(10);
  });
});

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires first and last with the latest arguments', () => {
    const seen: number[] = [];
    const call = throttle((value: number) => seen.push(value), 100);
    call(1);
    call(2);
    call(3);
    expect(seen).toEqual([1]);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual([1, 3]);
  });

  it('drops the trailing call on cancel', () => {
    const seen: number[] = [];
    const call = throttle((value: number) => seen.push(value), 100);
    call(1);
    call(2);
    call.cancel();
    vi.advanceTimersByTime(200);
    expect(seen).toEqual([1]);
  });
});
