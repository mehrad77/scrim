import { uid } from './ids.js';
import { SHOW_FORMAT_VERSION, type Cue, type Inputs, type Output, type Show } from './schema.js';

export function defaultInputs(): Inputs {
  return {
    // Physical keys (KeyboardEvent.code), so the map survives non-US layouts.
    keys: [
      { key: 'Space', command: { type: 'go' } },
      { key: 'Escape', command: { type: 'panic' } },
      { key: 'KeyH', command: { type: 'hold' } },
      { key: 'ArrowDown', command: { type: 'standbyNext' } },
      { key: 'ArrowUp', command: { type: 'standbyPrev' } },
    ],
    midi: [],
    gamepad: [],
  };
}

export function createOutput(name = 'Main stage', width = 1920, height = 1080): Output {
  return { id: uid('out'), name, width, height, background: '#000000', safeArea: 0.05 };
}

export function createCue(sceneId: string, name: string): Cue {
  return {
    id: uid('cue'),
    sceneId,
    name,
    actions: [],
    follow: { auto: false, delay: 0 },
    notes: '',
    updatedAt: Date.now(),
  };
}

export function createShow(name: string): Show {
  const now = Date.now();
  const scene = { id: uid('scn'), name: 'Scene 1' };
  return {
    format: 'scrim-show',
    version: SHOW_FORMAT_VERSION,
    id: uid('show'),
    name,
    createdAt: now,
    updatedAt: now,
    outputs: [createOutput()],
    media: [],
    layers: [],
    scenes: [scene],
    cues: [createCue(scene.id, 'Preshow')],
    vars: [],
    moments: [],
    triggers: [],
    rules: [],
    inputs: defaultInputs(),
    audioBuses: [{ id: 'main', name: 'Main' }],
  };
}
