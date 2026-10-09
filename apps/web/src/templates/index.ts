import type { TemplateSeed } from './types.js';

/** Every template in the gallery, in the order each group shows them. */
export const TEMPLATES: TemplateSeed[] = [];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
