import { driftTarget, ease, frameTime, isTooSlow, pointerEnergy, renderSize } from './haze-motion';

const samples = (count: number, ms: number) => new Array<number>(count).fill(ms);

describe('renderSize', () => {
  it('renders at 0.6 of the window at a device pixel ratio of 1 or more', () => {
    expect(renderSize(1000, 500, 2)).toEqual({ width: 600, height: 300 });
  });

  it('renders lower at a device pixel ratio below 1', () => {
    expect(renderSize(1000, 500, 0.5)).toEqual({ width: 300, height: 150 });
  });

  it('never returns a size of 0', () => {
    expect(renderSize(1, 1, 0.5)).toEqual({ width: 1, height: 1 });
  });
});

describe('ease', () => {
  it('eases towards the target by the factor', () => {
    expect(ease(0, 100, 0.045)).toBeCloseTo(4.5);
    expect(ease(100, 0, 0.5)).toBeCloseTo(50);
  });
});

describe('driftTarget', () => {
  it('follows the path of the spec', () => {
    const start = driftTarget(0, 1000, 1000);
    expect(start.x).toBeCloseTo(550);
    expect(start.y).toBeCloseTo(650);
  });

  it('drifts inside the window', () => {
    for (let now = 0; now < 600_000; now += 500) {
      const { x, y } = driftTarget(now, 1000, 500);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1000);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(500);
    }
  });
});

describe('pointerEnergy', () => {
  const FRAME_AT_60_HZ = 1000 / 60;

  it('grows with the distance of a move', () => {
    expect(pointerEnergy(0, 100, 0)).toBeCloseTo(0.25);
    expect(pointerEnergy(0.25, 100, 0)).toBeCloseTo(0.5);
  });

  it('never exceeds 1', () => {
    expect(pointerEnergy(0.9, 400, 0)).toBe(1);
  });

  it('fades by 0.94 per frame at 60 Hz', () => {
    expect(pointerEnergy(1, 0, FRAME_AT_60_HZ)).toBeCloseTo(0.94, 8);
  });

  it('fades alike at every frame rate', () => {
    let at120Hz = 1;
    for (let frame = 0; frame < 120; frame++) {
      at120Hz = pointerEnergy(at120Hz, 0, FRAME_AT_60_HZ / 2);
    }
    let at30Hz = 1;
    for (let frame = 0; frame < 30; frame++) {
      at30Hz = pointerEnergy(at30Hz, 0, FRAME_AT_60_HZ * 2);
    }
    expect(at120Hz).toBeCloseTo(0.94 ** 60, 8);
    expect(at30Hz).toBeCloseTo(0.94 ** 60, 8);
  });

  it('stays 0 without a move', () => {
    expect(pointerEnergy(0, 0, 1000)).toBe(0);
  });
});

describe('frameTime', () => {
  it('is the time since the last frame', () => {
    expect(frameTime(116, 100)).toBe(16);
  });

  it('still counts a frame of exactly one second', () => {
    expect(frameTime(1100, 100)).toBe(1000);
  });

  // A hidden tab or a sleeping laptop pauses the frames; that says nothing about the GPU.
  it('ignores a gap above one second', () => {
    expect(frameTime(1101, 100)).toBeNull();
  });

  it('never gets too slow from several gaps between 60 Hz frames', () => {
    const times: number[] = [];
    let previous = 1;
    for (let frame = 1; frame <= 1000; frame++) {
      const now = previous + (frame % 20 === 0 ? 5000 : 16.7);
      const time = frameTime(now, previous);
      previous = now;
      if (time !== null) times.push(time);
      expect(isTooSlow(times.slice(-120))).toBe(false);
    }
    expect(times.length).toBeGreaterThan(900);
  });
});

describe('isTooSlow', () => {
  it('is not too slow with less than 120 samples', () => {
    expect(isTooSlow(samples(119, 100))).toBe(false);
  });

  it('is not too slow at 16 ms', () => {
    expect(isTooSlow(samples(120, 16))).toBe(false);
  });

  // Power saving and 30 Hz monitors throttle the frames; that says nothing about the GPU.
  it('is not too slow at a throttled 30 Hz', () => {
    expect(isTooSlow(samples(120, 33.4))).toBe(false);
  });

  it('is not too slow at exactly 40 ms', () => {
    expect(isTooSlow(samples(120, 40))).toBe(false);
  });

  it('is too slow at 41 ms', () => {
    expect(isTooSlow(samples(120, 41))).toBe(true);
  });
});
