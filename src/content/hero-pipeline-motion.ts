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

/** `time` runs from 0 to heroCycleMs. */
export function heroFrame(pipeline: HeroPipeline, time: number): HeroFrame {
  const { reached, stations } = pipeline;
  const resetting = time > heroCycleMs(pipeline) - FADE_MS;
  let rest = time;
  let finished = 0;
  let running = -1;
  let progress = 0;
  let dot = 0;

  for (let index = 0; index <= reached; index++) {
    if (rest < SPIN_MS) {
      running = index;
      break;
    }
    rest -= SPIN_MS;
    finished = index + 1;
    if (index === reached) break;
    if (rest < TRAVEL_MS) {
      const share = rest / TRAVEL_MS;
      progress = (index + ease(share)) / segments(pipeline);
      dot = Math.sin(Math.PI * share);
      break;
    }
    rest -= TRAVEL_MS;
    progress = (index + 1) / segments(pipeline);
  }

  return {
    states: stations.map((station, index) => {
      if (index > reached) return station.state;
      if (resetting) return 'idle';
      if (index < finished) return station.state;
      return index === running ? 'running' : 'idle';
    }),
    progress,
    dot,
    resetting,
  };
}
