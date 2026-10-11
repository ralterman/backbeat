/**
 * Server-side checks for the contact form. Pure functions — no I/O — so they
 * can be unit-tested directly. Every rejection message is written for the
 * person who hit it, not for a log.
 */

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export const MIN_MESSAGE_LENGTH = 20;

/** Share of a message that must be ordinary text (letters, spaces, common
 *  punctuation) before it is treated as real words. Below this it's mostly
 *  symbols, digits, URLs or emoji — the usual shape of bot filler. */
export const MIN_TEXT_RATIO = 0.6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Vowels including y and the common accented forms, so "Yves", "Ngô" and
// "Søren" pass. Pure-consonant strings ("Xzqpt", "BRRRR") do not. The rule
// only applies to the Latin letters in a name: a name written entirely in
// another script (Cyrillic, Greek, CJK, Arabic…) has no Latin vowels to
// check and must not be rejected for it.
const VOWEL_RE = /[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüýÿœ]/iu;
const LATIN_RE = /[A-Za-zÀ-ÖØ-öø-ÿœ]/u;

// What counts as "dictionary-ish": any letter in any script, whitespace, and
// the punctuation a sentence normally contains.
const TEXT_CHAR_RE = /[\p{L}\s.,;:'"!?()\-–—]/u;

/** True unless the string has Latin letters and none of them is a vowel. */
export function hasVowel(s: string): boolean {
  if (!LATIN_RE.test(s)) return true;
  return VOWEL_RE.test(s);
}

/** Fraction of characters that are letters, whitespace or sentence punctuation. */
export function textRatio(s: string): number {
  const chars = Array.from(s);
  if (chars.length === 0) return 0;
  let text = 0;
  for (const c of chars) if (TEXT_CHAR_RE.test(c)) text++;
  return text / chars.length;
}

/**
 * Returns a user-facing error string, or null if the submission is acceptable.
 * Order matters: required-field and format errors first (they're the ones a
 * real person most likely hit), spam-shape checks after.
 */
export function validateContact(input: Partial<ContactInput>): string | null {
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const message = input.message?.trim() ?? "";

  if (!name || !email || !message) {
    return "Name, email, and message are all required.";
  }
  if (!EMAIL_RE.test(email)) {
    return "Please enter a valid email address.";
  }
  if (message.length < MIN_MESSAGE_LENGTH) {
    return `Please tell us a little more — messages need to be at least ${MIN_MESSAGE_LENGTH} characters.`;
  }
  if (!/\s/.test(message)) {
    return "That message looks like a single word or link. Please write a sentence or two.";
  }
  if (!hasVowel(name)) {
    return "Please enter your name as you'd normally write it.";
  }
  if (textRatio(message) < MIN_TEXT_RATIO) {
    return "That message is mostly symbols or links. Please write it out in plain words.";
  }
  return null;
}
