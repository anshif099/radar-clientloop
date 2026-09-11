import { Buffer } from "node:buffer";
import dictionary from "dictionary-en";
import nspell from "nspell";
import type { WritingCorrection } from "./quality-tools";

const englishSpelling = nspell({
  aff: Buffer.from(dictionary.aff),
  dic: Buffer.from(dictionary.dic),
});

const dictionaryWordsByLength = new Map<number, string[]>();
for (const entry of new TextDecoder().decode(dictionary.dic).split(/\r?\n/).slice(1)) {
  const word = entry.split("/", 1)[0]?.toLowerCase();
  if (!word || !/^[a-z']+$/.test(word)) continue;
  const words = dictionaryWordsByLength.get(word.length) ?? [];
  words.push(word);
  dictionaryWordsByLength.set(word.length, words);
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? right.length;
}

function preserveCase(source: string, replacement: string) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function suggestWriting(word: string, limit = 4) {
  const normalized = word.toLowerCase();
  if (normalized.length < 3 || !/^[a-z']+$/.test(normalized) || englishSpelling.correct(normalized)) return [];

  const suggestions = new Set<string>();
  // Adjacent key transpositions are common while typing. Prefer the swapped
  // form when it is a dictionary word (for example, "teh" becomes "the").
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const transposed = `${normalized.slice(0, index)}${normalized[index + 1]}${normalized[index]}${normalized.slice(index + 2)}`;
    if (englishSpelling.correct(transposed)) suggestions.add(transposed);
  }
  for (const suggestion of englishSpelling.suggest(normalized)) {
    const candidate = suggestion.toLowerCase();
    if (/^[a-z']+$/.test(candidate)) suggestions.add(candidate);
  }
  const maximumDistance = normalized.length >= 7 ? 2 : 1;
  const fuzzy: Array<{ word: string; distance: number }> = [];
  for (let length = normalized.length - maximumDistance; length <= normalized.length + maximumDistance; length += 1) {
    for (const candidate of dictionaryWordsByLength.get(length) ?? []) {
      if (suggestions.has(candidate)) continue;
      const distance = editDistance(normalized, candidate);
      if (distance <= maximumDistance) fuzzy.push({ word: candidate, distance });
    }
  }
  fuzzy.sort((left, right) => left.distance - right.distance || left.word.localeCompare(right.word));
  for (const candidate of fuzzy) suggestions.add(candidate.word);
  return [...suggestions].slice(0, Math.max(1, Math.min(limit, 8))).map((suggestion) => preserveCase(word, suggestion));
}

function dictionaryCorrection(word: string) {
  // Full-text correction only applies an unambiguous nearest choice. Ambiguous
  // words are offered interactively by suggestWriting instead of being guessed.
  if (word.length < 4 || word !== word.toLowerCase()) return undefined;
  const suggestions = suggestWriting(word, 8);
  if (!suggestions.length) return undefined;
  const scored = suggestions.map((suggestion) => ({ suggestion, distance: editDistance(word, suggestion.toLowerCase()) }));
  const nearestDistance = Math.min(...scored.map(({ distance }) => distance));
  const nearest = scored.filter(({ distance }) => distance === nearestDistance);
  return nearest.length === 1 ? nearest[0]?.suggestion : undefined;
}

function languageOf(text: string) {
  const hasMalayalam = /[\u0D00-\u0D7F]/u.test(text);
  const hasLatin = /[A-Za-z]/.test(text);
  return hasMalayalam && hasLatin ? "Malayalam and English" : hasMalayalam ? "Malayalam" : "English or Manglish";
}

export function correctWriting(source: string): WritingCorrection {
  const changes = new Set<string>();
  const protectedValues: string[] = [];
  let text = source.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, (value) => {
    protectedValues.push(value);
    return `\uE000${protectedValues.length - 1}\uE001`;
  });

  text = text.replace(/\b[A-Za-z']+\b/g, (word) => {
    const replacement = dictionaryCorrection(word);
    if (!replacement) return word;
    const corrected = preserveCase(word, replacement);
    changes.add(`Corrected "${word}" to "${corrected}"`);
    return corrected;
  });

  const grammarRules: Array<{ pattern: RegExp; replacement: string; description: string }> = [
    { pattern: /\bthis are\b/gi, replacement: "this is", description: "Corrected subject-verb agreement" },
    { pattern: /\bthese is\b/gi, replacement: "these are", description: "Corrected subject-verb agreement" },
    { pattern: /\bI is\b/g, replacement: "I am", description: "Corrected subject-verb agreement" },
    { pattern: /\bI are\b/g, replacement: "I am", description: "Corrected subject-verb agreement" },
    { pattern: /\bcan able to\b/gi, replacement: "can", description: "Removed redundant wording" },
    { pattern: /\bmore better\b/gi, replacement: "better", description: "Corrected comparative grammar" },
    { pattern: /\bdiscuss about\b/gi, replacement: "discuss", description: "Corrected verb usage" },
  ];
  for (const rule of grammarRules) {
    const corrected = text.replace(rule.pattern, rule.replacement);
    if (corrected !== text) {
      text = corrected;
      changes.add(rule.description);
    }
  }

  const spacing = text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ");
  if (spacing !== text) changes.add("Corrected punctuation spacing");
  text = spacing;

  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix: string, letter: string) => {
    changes.add("Capitalized sentence beginnings");
    return `${prefix}${letter.toUpperCase()}`;
  });
  text = text.replace(/\bi\b/g, () => {
    changes.add('Capitalized "I"');
    return "I";
  });
  text = text.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedValues[Number(index)] ?? "");

  return { correctedText: text, changes: [...changes], language: languageOf(source) };
}
