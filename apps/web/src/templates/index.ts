import { BIRTHDAY } from './birthday.js';
import { GATHERING } from './gathering.js';
import { GIG } from './gig.js';
import { MEMORY_SESSION } from './memorySession.js';
import { MUSEUM } from './museum.js';
import { QUIZ } from './quiz.js';
import { SCHOOL_PLAY } from './schoolPlay.js';
import type { TemplateSeed } from './types.js';

/** Every template in the gallery, in the order each group shows them. */
export const TEMPLATES: TemplateSeed[] = [
  SCHOOL_PLAY,
  GATHERING,
  MEMORY_SESSION,
  MUSEUM,
  QUIZ,
  BIRTHDAY,
  GIG,
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
