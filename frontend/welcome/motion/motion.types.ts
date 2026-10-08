export type SectionId = string;

export interface FrameInput {
  timeSec: number;
  deltaSec: number;
  scrollYPx: number;
  velocityPxPerSec: number;
  pointerNdc: { x: number; y: number };
  viewport: { width: number; height: number; dpr: number };
  reducedMotion: boolean;
}

export interface SceneController {
  id: SectionId;
  update(frame: FrameInput, progress: number): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export interface MotionRuntime {
  register(scene: SceneController, range?: ScrollRange): void;
  unregister(id: SectionId): void;
  scrollTo(target: number | HTMLElement, offset?: number): void;
  setTestInput(input: { scrollYPx?: number; elapsedSec?: number; pointerNdc?: { x: number; y: number }; reducedMotion?: boolean }): void;
  dispose(): void;
}

export interface ScrollRange {
  startPx: number;
  endPx: number;
}

export interface ChannelKey {
  at: number;
  value: number;
  ease?: string;
}

export interface MotionSpec {
  id: string;
  sectionId: SectionId;
  driver: 'scroll' | 'time' | 'pointer' | 'event';
  referenceStateIds: string[];
  startRule: string;
  endRule: string;
  channels: Array<{
    target: string;
    property: string;
    keys: ChannelKey[];
  }>;
}
