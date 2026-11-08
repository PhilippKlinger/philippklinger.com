// Where the looping run of the hero pipeline stands at a given time. Pure, so the timing is
// testable; the component only asks for frames.
import { HeroPipeline, HeroStationState } from './hero-pipeline';

/** idle and running exist only while the run moves, the rest is the state from the status. */
export type HeroFrameState = HeroStationState | 'idle' | 'running';

export interface HeroFrame {
  states: HeroFrameState[];
  /** Share of the line that is drawn, 0 to 1. */
  progress: number;
  /** Opacity of the dot on the line. */
  dot: number;
  resetting: boolean;
}

const SPIN_MS = 900;
const TRAVEL_MS = 800;
const HOLD_MS = 3500;
const FADE_MS = 400;

const segments = (pipeline: HeroPipeline) => pipeline.stations.length - 1;
const ease = (share: number) => 0.5 - 0.5 * Math.cos(Math.PI * share);

export function heroCycleMs(pipeline: HeroPipeline): number {
  const { reached } = pipeline;
  return (reached + 1) * SPIN_MS + reached * TRAVEL_MS + HOLD_MS + FADE_MS;
}

export function heroFinalFrame(pipeline: HeroPipeline): HeroFrame {
  return {
    states: pipeline.stations.map((station) => station.state),
    progress: Math.max(pipeline.reached, 0) / segments(pipeline),
    dot: 0,
    resetting: false,
  };
}

/** Where the run stands: the stations it finished, the one that spins, the line and its dot. */
interface Position {
  finished: number;
  running: number;
  progress: number;
  dot: number;
}

const travelling = (at: Position, pipeline: HeroPipeline, index: number, share: number) => ({
  ...at,
  progress: (index + ease(share)) / segments(pipeline),
  dot: Math.sin(Math.PI * share),
});

function position(pipeline: HeroPipeline, time: number): Position {
  const at: Position = { finished: 0, running: -1, progress: 0, dot: 0 };
  let rest = time;
  for (let index = 0; index <= pipeline.reached; index++) {
    if (rest < SPIN_MS) return { ...at, running: index };
    rest -= SPIN_MS;
    at.finished = index + 1;
    if (index === pipeline.reached) return at;
    if (rest < TRAVEL_MS) return travelling(at, pipeline, index, rest / TRAVEL_MS);
    rest -= TRAVEL_MS;
    at.progress = (index + 1) / segments(pipeline);
  }
  return at;
}

// Stations the run does not reach keep their state from the status, also through the fade.
function frameStates(pipeline: HeroPipeline, at: Position, resetting: boolean): HeroFrameState[] {
  return pipeline.stations.map((station, index) => {
    if (index > pipeline.reached) return station.state;
    if (resetting) return 'idle';
    if (index < at.finished) return station.state;
    return index === at.running ? 'running' : 'idle';
  });
}

/** `time` runs from 0 to heroCycleMs. */
export function heroFrame(pipeline: HeroPipeline, time: number): HeroFrame {
  const resetting = time > heroCycleMs(pipeline) - FADE_MS;
  const at = position(pipeline, time);
  return {
    states: frameStates(pipeline, at, resetting),
    progress: at.progress,
    dot: at.dot,
    resetting,
  };
}
