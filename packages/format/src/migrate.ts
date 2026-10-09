import { ShowSchema, SHOW_FORMAT_VERSION, type Show } from './schema.js';

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a version-n document to version n+1. */
const migrations: Record<number, Migration> = {};

export class ShowFormatError extends Error {
  override name = 'ShowFormatError';
}

/** Validate an unknown value as a show, upgrading older format versions first. */
export function parseShow(input: unknown): Show {
  if (typeof input !== 'object' || input === null) throw new ShowFormatError('Not a show document');
  let doc = input as Record<string, unknown>;
  if (doc.format !== 'scrim-show') throw new ShowFormatError('Not a Scrim show');
  let version = typeof doc.version === 'number' ? doc.version : NaN;
  if (!Number.isInteger(version) || version < 1)
    throw new ShowFormatError('Missing format version');
  if (version > SHOW_FORMAT_VERSION) {
    throw new ShowFormatError(
      `This show was made with a newer Scrim (format ${version}); update the app to open it`,
    );
  }
  while (version < SHOW_FORMAT_VERSION) {
    const step = migrations[version];
    if (!step) throw new ShowFormatError(`No migration from format ${version}`);
    doc = { ...step(doc), version: version + 1 };
    version += 1;
  }
  const result = ShowSchema.safeParse(doc);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ShowFormatError(
      `Invalid show: ${issue ? `${issue.path.join('.')}: ${issue.message}` : 'unknown error'}`,
    );
  }
  return keepUnknown(doc, result.data) as Show;
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Put back the fields validation dropped because this app doesn't know them, so a show made
 * with a newer Scrim keeps them when it is saved here. Types only describe the known fields.
 */
function keepUnknown(raw: unknown, parsed: unknown): unknown {
  if (Array.isArray(raw) && Array.isArray(parsed) && raw.length === parsed.length)
    return parsed.map((item, i) => keepUnknown(raw[i], item));
  if (!isRecord(raw) || !isRecord(parsed)) return parsed;
  const out: Record<string, unknown> = { ...parsed };
  for (const [key, value] of Object.entries(raw))
    out[key] = key in parsed ? keepUnknown(value, parsed[key]) : structuredClone(value);
  return out;
}
