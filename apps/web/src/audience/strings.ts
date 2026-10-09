import { createContext, useContext } from 'react';

/**
 * Every word the audience page says, in English. Other languages load on demand from
 * `i18n/<code>.ts` (only what a phone picks is downloaded) and fall back to these. The show's own
 * words (prompts, options, captions) come from the show, translated by its team.
 */
export const EN = {
  join: 'Join the show',
  joinHint: 'Type the code on your ticket or the screen.',
  roomCode: 'Room code',
  joinButton: 'Join',
  joined: 'Joined',
  closed: 'Closed',
  connecting: 'Connecting…',
  roomFull: 'This room is full.',
  roomNotOpen: 'This room is not open.',
  checkCode: 'Check the code with the front of house team.',
  otherCode: 'Enter another code',
  thanks: 'Thank you!',
  watch: 'Watch the stage',
  onItsWay: 'Your answer is on its way to the stage.',
  keepOpen: 'Keep this page open. When it is your turn, it will light up here.',
  passOn: 'Thank you — pass it on',
  nextPerson: 'Next person',
  changeAnswer: 'Change my answer',
  voteCounted: 'Vote counted. You can change it until voting closes.',
  tap: 'TAP',
  shake: 'Or shake your phone',
  sent: 'Sent',
  done: 'Done',
  maxSent: 'Thanks — you’ve sent the maximum of three.',
  typeHere: 'Type here',
  send: 'Send',
  sentPicked: 'Sent. The team may pick it to appear on stage.',
  onlyYours: 'Only your phone shows this.',
  access: 'Access',
  accessHint: 'Choose what helps you. Your choices stay on this phone.',
  language: 'Language',
  captions: 'Captions',
  captionsHint: 'What is said and sung, at the bottom of the screen.',
  textSize: 'Text size',
  sizeStandard: 'Standard',
  sizeLarge: 'Large',
  sizeLargest: 'Largest',
  describe: 'Audio description',
  describeHint: 'What is seen, read aloud. Use headphones.',
  describeOn: 'Audio description is on.',
  vibrate: 'Vibrate',
  vibrateHint: 'A buzz for sound cues and when it’s your turn.',
  warnings: 'Content warnings',
  warningsHint: 'A note before intense moments.',
  comingUp: 'Coming up',
  stepOut: 'It’s OK to step out and come back.',
};

export type Strings = typeof EN;

/** The page's strings; Audience provides the chosen language. */
export const StringsContext = createContext<Strings>(EN);
export const useStrings = () => useContext(StringsContext);

/** Language packs, loaded only when a phone picks one. */
const packs = import.meta.glob<{ default: Partial<Strings> }>('./i18n/*.ts');

export async function loadStrings(lang: string): Promise<Strings> {
  const load = packs[`./i18n/${lang}.ts`] ?? packs[`./i18n/${lang.split('-')[0]}.ts`];
  if (!load) return EN;
  return { ...EN, ...(await load()).default };
}

export const hasPack = (lang: string) =>
  lang === 'en' || `./i18n/${lang}.ts` in packs || `./i18n/${lang.split('-')[0]}.ts` in packs;

/** Scripts written right to left. */
export const isRtl = (lang: string) => ['ar', 'fa', 'he', 'ur'].includes(lang.split('-')[0]!);

/** A language's own name ("Français"), or its code when the phone can't name it. */
export function languageName(lang: string): string {
  try {
    const name = new Intl.DisplayNames([lang], { type: 'language' }).of(lang);
    return name ? name[0]!.toLocaleUpperCase(lang) + name.slice(1) : lang;
  } catch {
    return lang;
  }
}
