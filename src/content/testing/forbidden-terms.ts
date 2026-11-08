/** A word stem of fixed length, known only by its SHA-256 digest. */
export interface Term {
  length: number;
  digest: string;
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const windows = (word: string, length: number) =>
  Array.from({ length: Math.max(0, word.length - length + 1) }, (_, i) =>
    word.slice(i, i + length),
  );

/** True if any word of the text contains a stem; no word boundaries, like a plain regex. */
export async function findForbiddenTerm(text: string, terms: readonly Term[]): Promise<boolean> {
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  const digests = new Set(terms.map(({ digest }) => digest));
  for (const { length } of terms) {
    for (const part of new Set(words.flatMap((word) => windows(word, length)))) {
      if (digests.has(await sha256(part))) return true;
    }
  }
  return false;
}

// Hashed so the public repo does not spell out private topics.
export const TOPIC_A: Term = {
  length: 8,
  digest: 'a17c07698fda713f092172e721d6d7e879ca94eaa9c973726c12d4bc2cc2d8f7',
};
export const TOPIC_B: Term = {
  length: 6,
  digest: '35c86777491b25c55e49aecf036dace29f83c45b3a6c0fc40ad79975f7fd72bd',
};
export const TOPIC_C: Term = {
  length: 6,
  digest: 'fbff4487abf46df134c65e83f3d17142768598ff45066516de8366797ad456e2',
};
