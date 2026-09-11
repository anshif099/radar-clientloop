import { Buffer } from "node:buffer";
import dictionary from "dictionary-en";
import nspell from "nspell";
import type { WritingCorrection } from "./quality-tools";

const spelling: Record<string, string> = {
  adress: "address",
  applicaiton: "application",
  aplication: "application",
  appliction: "application",
  applitacion: "application",
  becuase: "because",
  cant: "can't",
  currection: "correction",
  definately: "definitely",
  didnt: "didn't",
  doesnt: "doesn't",
  dont: "don't",
  grammer: "grammar",
  havent: "haven't",
  isnt: "isn't",
  occured: "occurred",
  plase: "please",
  recomend: "recommend",
  recieve: "receive",
  recieved: "received",
  seperate: "separate",
  thier: "their",
  teh: "the",
  wont: "won't",
  writting: "writing",
  youre: "you're",
};

const englishSpelling = nspell({
  aff: Buffer.from(dictionary.aff),
  dic: Buffer.from(dictionary.dic),
});

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

function dictionaryCorrection(word: string) {
  // Avoid guessing at names, acronyms, short words, or Manglish. Automatically
  // apply only an unambiguous one-edit English dictionary suggestion.
  if (word.length < 4 || word !== word.toLowerCase() || englishSpelling.correct(word)) return undefined;
  const suggestions = [...new Set(englishSpelling.suggest(word).map((suggestion) => suggestion.toLowerCase()))]
    .filter((suggestion) => /^[a-z']+$/.test(suggestion));
  if (!suggestions.length) return undefined;
  const scored = suggestions.map((suggestion) => ({ suggestion, distance: editDistance(word, suggestion) }));
  const nearestDistance = Math.min(...scored.map(({ distance }) => distance));
  const nearest = scored.filter(({ distance }) => distance === nearestDistance);
  return nearestDistance === 1 && nearest.length === 1 ? nearest[0]?.suggestion : undefined;
}

function preserveCase(source: string, replacement: string) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
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
    const replacement = spelling[word.toLowerCase()] ?? dictionaryCorrection(word);
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
