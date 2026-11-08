import { HeroPipeline, HeroStationState } from './hero-pipeline';
import { heroCycleMs, heroFrame, heroFinalFrame } from './hero-pipeline-motion';

function pipeline(states: HeroStationState[], reached: number): HeroPipeline {
  return {
    stations: states.map((state, index) => ({ name: `S${index}`, state, value: [] })),
    reached,
    note: null,
    still: reached < 0,
  };
}

const allDone = pipeline(['done', 'done', 'done', 'done', 'done', 'done'], 5);
const redChecks = pipeline(['done', 'failed', 'open', 'open', 'held', 'held'], 1);

describe('heroCycleMs', () => {
  it('adds spinner, travel, hold and fade of the stations the run reaches', () => {
    expect(heroCycleMs(allDone)).toBe(6 * 900 + 5 * 800 + 3500 + 400);
    expect(heroCycleMs(redChecks)).toBe(2 * 900 + 800 + 3500 + 400);
  });
});

describe('heroFrame', () => {
  it('starts with the first station checking and nothing else reached', () => {
    const frame = heroFrame(allDone, 0);
    expect(frame.states).toEqual(['running', 'idle', 'idle', 'idle', 'idle', 'idle']);
    expect(frame.progress).toBe(0);
    expect(frame.dot).toBe(0);
    expect(frame.resetting).toBe(false);
  });

  it('marks a station done when its spinner ends and moves on smoothly', () => {
    const frame = heroFrame(allDone, 900 + 400);
    expect(frame.states).toEqual(['done', 'idle', 'idle', 'idle', 'idle', 'idle']);
    expect(frame.progress).toBeCloseTo(0.1);
    expect(frame.dot).toBeCloseTo(1);
  });

  it('eases the line in with a sine, slower than linear at the start', () => {
    // A quarter of the way the sine has drawn 0.146 of the segment, linear would be 0.25.
    const frame = heroFrame(allDone, 900 + 200);
    expect(frame.progress).toBeCloseTo((0.5 - 0.5 * Math.cos(Math.PI / 4)) / 5, 5);
    expect(frame.dot).toBeCloseTo(Math.sin(Math.PI / 4), 5);
  });

  it('starts the next spinner when the line has arrived', () => {
    const frame = heroFrame(allDone, 900 + 800);
    expect(frame.states).toEqual(['done', 'running', 'idle', 'idle', 'idle', 'idle']);
    expect(frame.progress).toBeCloseTo(0.2);
    expect(frame.dot).toBe(0);
  });

  it('holds the finished chain', () => {
    const frame = heroFrame(allDone, 6 * 900 + 5 * 800);
    expect(frame.states).toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
    expect(frame.progress).toBe(1);
    expect(frame.resetting).toBe(false);
  });

  it('fades everything the run reached before it starts again', () => {
    const frame = heroFrame(allDone, heroCycleMs(allDone) - 100);
    expect(frame.states).toEqual(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
    expect(frame.resetting).toBe(true);
  });

  it('ends at a red station and leaves the rest as the status says', () => {
    const frame = heroFrame(redChecks, 2 * 900 + 800);
    expect(frame.states).toEqual(['done', 'failed', 'open', 'open', 'held', 'held']);
    expect(frame.progress).toBeCloseTo(0.2);
  });

  it('keeps open and held stations through the fade', () => {
    const frame = heroFrame(redChecks, heroCycleMs(redChecks) - 100);
    expect(frame.states).toEqual(['idle', 'idle', 'open', 'open', 'held', 'held']);
  });
});

describe('heroFinalFrame', () => {
  it('shows the end state without movement, for reduced motion and the prerender', () => {
    expect(heroFinalFrame(redChecks)).toEqual({
      states: ['done', 'failed', 'open', 'open', 'held', 'held'],
      progress: 0.2,
      dot: 0,
      resetting: false,
    });
  });

  it('has no line when the run reaches nothing', () => {
    expect(heroFinalFrame(pipeline(['held', 'held', 'held', 'held', 'held', 'held'], -1))).toEqual({
      states: ['held', 'held', 'held', 'held', 'held', 'held'],
      progress: 0,
      dot: 0,
      resetting: false,
    });
  });
});
