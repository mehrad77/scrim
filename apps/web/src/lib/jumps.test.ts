import { createCue, createShow, type Show } from '@scrim/format';
import { describe, expect, it } from 'vitest';
import { jumpTargetText, orderChangeText, sectionsOf } from './jumps.js';
import { checkLogic } from './logic.js';
import { removeCue, removeScene } from './refs.js';

function gig(): Show {
  const show = createShow('Gig');
  show.scenes = [
    { id: 'a', name: 'Amazing Grace' },
    { id: 'b', name: 'River' },
    { id: 'c', name: 'Encore' },
  ];
  show.cues = [
    { ...createCue('a', 'Verse'), id: 'a1', section: 'Verse' },
    { ...createCue('a', 'Chorus'), id: 'a2', section: 'Chorus' },
    { ...createCue('b', 'Intro'), id: 'b1', section: ' chorus ' },
    { ...createCue('c', 'Bow'), id: 'c1' },
  ];
  show.setlists = [{ id: 'set', name: 'Friday', scenes: ['c', 'b', 'a'] }];
  return show;
}

describe('jumps', () => {
  it('describes where a jump goes and lists sections once', () => {
    const show = gig();
    expect(jumpTargetText(show, { to: 'scene', sceneId: 'b' })).toBe('Scene “River”');
    expect(jumpTargetText(show, { to: 'scene', sceneId: 'gone' })).toBe('Scene that was deleted');
    expect(jumpTargetText(show, { to: 'section', section: 'Chorus' })).toBe('Section “Chorus”');
    expect(jumpTargetText(show, { to: 'nextScene' })).toBe('Next scene');
    expect(sectionsOf(show)).toEqual(['Verse', 'Chorus']);
  });

  it('says what changed in the running order', () => {
    const show = gig();
    const order = (scenes: string[], skipped: string[] = []) => ({ scenes, skipped });
    expect(orderChangeText(show, null, order(['a', 'b', 'c'], ['b']))).toBe('Skipped “River”');
    expect(orderChangeText(show, order(['a', 'b', 'c'], ['b']), order(['a', 'b', 'c']))).toBe(
      'Brought back “River”',
    );
    expect(orderChangeText(show, null, order(['a', 'c', 'b']))).toBe(
      'Moved “Encore” after “Amazing Grace”',
    );
    expect(orderChangeText(show, null, order(['c', 'a', 'b']))).toBe('Moved “Encore” to the top');
    expect(orderChangeText(show, order(['a', 'b', 'c']), null)).toBe(
      'Running order: back to the show’s order',
    );
  });

  it('flags a jump to a section no cue has', () => {
    const show = gig();
    show.cues[3]!.actions = [{ type: 'jumpSection', section: 'Bridge', fire: false }];
    expect(checkLogic(show).map((i) => i.text)).toContain(
      'Cue “Bow” uses the section “Bridge”, which no cue has',
    );
    show.cues[3]!.actions = [{ type: 'jumpSection', section: 'CHORUS', fire: false }];
    expect(checkLogic(show).some((i) => i.text.includes('section'))).toBe(false);
  });

  it('deleting a scene or cue removes it from setlists and from jump mappings', () => {
    const show = gig();
    show.inputs.midi.push(
      { kind: 'program', channel: null, number: 1, command: jump({ to: 'scene', sceneId: 'b' }) },
      { kind: 'program', channel: null, number: 2, command: jump({ to: 'scene', sceneId: 'c' }) },
    );
    show.inputs.keys.push({ key: 'KeyX', command: jump({ to: 'cue', cueId: 'c1' }) });
    removeScene(show, 'b');
    expect(show.setlists![0]!.scenes).toEqual(['c', 'a']);
    expect(show.inputs.midi.map((m) => m.number)).toEqual([2]);
    removeCue(show, 'c1');
    expect(show.inputs.keys.some((k) => k.key === 'KeyX')).toBe(false);
  });
});

function jump(target: Parameters<typeof jumpTargetText>[1]) {
  return { type: 'jump' as const, target, fire: true };
}
