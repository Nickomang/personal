export type Poe2Rarity =
  | "Normal"
  | "Magic"
  | "Rare"
  | "Unique"
  | "Gem"
  | "Currency"
  | "Quest"
  | "Unknown";

export interface Poe2ParsedItem {
  itemClass?: string;
  itemLevel?: number;

  rarity: Poe2Rarity;
  name?: string;
  baseType?: string;

  limits: string[];

  properties: string[];
  grantedSkills: string[];
  requirements?: string;
  sockets?: string;

  implicits: string[];
  enchants: string[];
  runes: string[];

  mods: string[];
  desecrated: string[];
  mutated: string[];

  footerFlags: string[];
  flavourText: string[];

  raw: string;
}

export function parsePoe2ItemText(rawInput: string): Poe2ParsedItem {
  const raw = normalize(rawInput);
  if (!raw) return emptyParsed(rawInput ?? "");

  const blocks = raw
    .split(/\n-{4,}\n/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (blocks.length === 0) return emptyParsed(raw);

  /* ---------------- Header ---------------- */

  const headerLines = (blocks.shift() ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let itemClass: string | undefined;
  let rarity: Poe2Rarity = "Unknown";
  let name: string | undefined;
  let baseType: string | undefined;

  let i = 0;

  if (headerLines[i]?.toLowerCase().startsWith("item class:")) {
    itemClass = normalizeItemClass(
      headerLines[i].slice("Item Class:".length).trim()
    );
    i++;
  }

  if (headerLines[i]?.toLowerCase().startsWith("rarity:")) {
    rarity = normalizeRarity(headerLines[i]);
    i++;
  }

  name = headerLines[i];
  baseType = headerLines[i + 1];

  /* ---------------- Pre-split remaining blocks ---------------- */

  const blockLines = blocks.map((b) =>
    b.split("\n").map((l) => l.trim()).filter(Boolean)
  );

  /* ---------------- Detect flavour block (positional) ----------------
     Rule:
     - Prefer block immediately ABOVE jewel instruction block
     - Else block immediately ABOVE flask instruction block
     - Else block immediately ABOVE corrupted block
  */

  const jewelIndex = findIndex(blockLines, isJewelInstructionBlock);
  const flaskIndex = findIndex(blockLines, isFlaskInstructionBlock);
  const corruptedIndex = findIndex(blockLines, isCorruptedBlock);

  let flavourBlockIndex = -1;

  if (jewelIndex > 0 && isLikelyFlavourBlock(blockLines[jewelIndex - 1])) {
    flavourBlockIndex = jewelIndex - 1;
  } else if (flaskIndex > 0 && isLikelyFlavourBlock(blockLines[flaskIndex - 1])) {
    flavourBlockIndex = flaskIndex - 1;
  } else if (
    corruptedIndex > 0 &&
    isLikelyFlavourBlock(blockLines[corruptedIndex - 1])
  ) {
    flavourBlockIndex = corruptedIndex - 1;
  }

  /* ---------------- Parsed content ---------------- */

  const limits: string[] = [];
  const properties: string[] = [];
  const grantedSkills: string[] = [];
  let requirements: string | undefined;
  let sockets: string | undefined;
  let itemLevel: number | undefined;

  const implicits: string[] = [];
  const enchants: string[] = [];
  const runes: string[] = [];

  const mods: string[] = [];
  const desecrated: string[] = [];
  const mutated: string[] = [];

  const footerFlags: string[] = [];
  const flavourText: string[] = [];

  /* ---------------- Parse blocks ---------------- */

  for (let b = 0; b < blockLines.length; b++) {
    const lines = blockLines[b];

    // Don't render instruction blocks (still used as anchors)
    if (isJewelInstructionBlock(lines) || isFlaskInstructionBlock(lines)) {
      continue;
    }

    // Flavour block gets stored and skipped from normal parsing
    if (b === flavourBlockIndex) {
      flavourText.push(...lines);
      continue;
    }

    for (const originalLine of lines) {
      const line = originalLine;

      if (/^Grants Skill:\s*/i.test(line)) {
        // Keep the whole line (you can strip the prefix in the renderer if you want)
        grantedSkills.push(line.replace(/^Grants Skill:\s*/i, "Grants Skill: ").trim());
        continue;
      }

      if (line === "Corrupted") {
        footerFlags.push("Corrupted");
        continue;
      }

      const limitMatch = line.match(/^Limited to:\s*(.+)$/i);
      if (limitMatch) {
        limits.push(`Limited to: ${limitMatch[1].trim()}`);
        continue;
      }

      if (line.toLowerCase().startsWith("item level:")) {
        const n = parseInt(line.slice("Item Level:".length).trim(), 10);
        if (!Number.isNaN(n)) itemLevel = n;
        continue;
      }

      if (line.toLowerCase().startsWith("requires:")) {
        requirements = stripTrailingParens(
          line.slice("Requires:".length).trim()
        );
        continue;
      }

      if (line.toLowerCase().startsWith("sockets:")) {
        sockets = stripTrailingParens(line.slice("Sockets:".length).trim());
        continue;
      }

      if (isPropertyLine(line)) {
        properties.push(stripTrailingParens(line));
        continue;
      }

      const tag = trailingKnownTag(line);
      const cleaned = stripTrailingParens(line);

      if (tag === "implicit") implicits.push(cleaned);
      else if (tag === "enchant") enchants.push(cleaned);
      else if (tag === "rune") runes.push(cleaned);
      else if (tag === "desecrated") desecrated.push(cleaned);
      else if (tag === "mutated") mutated.push(cleaned);
      else mods.push(cleaned);
    }
  }

  return {
    itemClass,
    itemLevel,
    rarity,
    name,
    baseType,
    limits,
    properties,
    grantedSkills,
    requirements,
    sockets,
    implicits,
    enchants,
    runes,
    mods,
    desecrated,
    mutated,
    footerFlags,
    flavourText,
    raw,
  };
}

/* ---------------- Helpers ---------------- */

function emptyParsed(raw: string): Poe2ParsedItem {
  return {
    rarity: "Unknown",
    properties: [],
    grantedSkills: [],
    limits: [],
    implicits: [],
    enchants: [],
    runes: [],
    mods: [],
    desecrated: [],
    mutated: [],
    footerFlags: [],
    flavourText: [],
    raw,
  };
}

function normalize(s: string) {
  return (s ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeRarity(line: string): Poe2Rarity {
  const r = line.replace(/^Rarity:\s*/i, "").toLowerCase();
  if (r.includes("normal")) return "Normal";
  if (r.includes("magic")) return "Magic";
  if (r.includes("rare")) return "Rare";
  if (r.includes("unique")) return "Unique";
  if (r.includes("gem")) return "Gem";
  if (r.includes("currency")) return "Currency";
  if (r.includes("quest")) return "Quest";
  return "Unknown";
}

function normalizeItemClass(s: string): string {
  return s
    .replace(/\bArmours\b/g, "Armour")
    .replace(/\bJewels\b/g, "Jewel")
    .trim();
}

function isPropertyLine(line: string): boolean {
  const l = line.toLowerCase();
  return (
    l.startsWith("quality") ||
    l.startsWith("physical damage:") ||
    l.startsWith("elemental damage:") ||
    l.startsWith("armour:") ||
    l.startsWith("evasion rating:") ||
    l.startsWith("energy shield:") ||
    l.startsWith("block chance:")
  );
}

type KnownTag =
  | "implicit"
  | "enchant"
  | "rune"
  | "desecrated"
  | "mutated"
  | null;

function trailingKnownTag(line: string): KnownTag {
  const m = line.match(/\((implicit|enchant|rune|desecrated|mutated)\)\s*$/i);
  return m ? (m[1].toLowerCase() as KnownTag) : null;
}

function stripTrailingParens(line: string): string {
  return line
    .replace(
      /\s*\((augmented|implicit|enchant|rune|desecrated|mutated)\)\s*$/i,
      ""
    )
    .trimEnd();
}

function findIndex<T>(arr: T[], pred: (x: T) => boolean): number {
  for (let i = 0; i < arr.length; i++) if (pred(arr[i])) return i;
  return -1;
}

/* ---------------- Instruction blocks ---------------- */

function isJewelInstructionBlock(lines: string[]): boolean {
  const text = lines.join(" ").toLowerCase();
  return (
    text.includes("place into an allocated jewel socket") &&
    text.includes("passive skill tree")
  );
}

function isFlaskInstructionBlock(lines: string[]): boolean {
  const text = lines.join(" ").toLowerCase();
  return (
    text.includes("right click to drink") &&
    text.includes("can only hold charges") &&
    text.includes("refill at wells")
  );
}

/* ---------------- Flavour anchors ---------------- */

function isCorruptedBlock(lines: string[]): boolean {
  return lines.some((l) => l === "Corrupted");
}

/**
 * Candidate flavour block (only evaluated for the single block above an anchor).
 * Accepts unquoted flavour, BUT rejects any block that looks like stats/mods/system.
 */
function isLikelyFlavourBlock(lines: string[]): boolean {
  if (lines.length === 0) return false;

  // Reject obvious system/stat blocks
  if (lines.some(looksLikeSystemLine)) return false;
  if (lines.some(looksLikeTaggedLine)) return false;

  // Strong positive signals (either one is enough)
  if (blockHasAnyQuote(lines)) return true;
  if (lines.some(isAttributionLine)) return true;

  // Otherwise accept only if it doesn't look like mods/stats
  if (lines.some(looksLikeModLine)) return false;

  return true;
}

function looksLikeSystemLine(line: string): boolean {
  const l = line.toLowerCase();
  return (
    l.startsWith("requires:") ||
    l.startsWith("sockets:") ||
    l.startsWith("item level:") ||
    l.startsWith("rarity:") ||
    l.startsWith("item class:") ||
    l.startsWith("limited to:") ||
    l === "corrupted" ||
    isPropertyLine(line)
  );
}

function looksLikeTaggedLine(line: string): boolean {
  return /\((augmented|implicit|enchant|rune|desecrated|mutated)\)\s*$/i.test(line);
}

function blockHasAnyQuote(lines: string[]): boolean {
  // Handles multi-line quotes where only the first line starts with a quote
  // and only the last line ends with a quote.
  const joined = lines.join("\n");
  return joined.includes('"') || joined.includes("“") || joined.includes("”");
}

function isAttributionLine(line: string): boolean {
  const s = line.trim();
  if (s.startsWith("—")) return true;
  // "- Atziri, Queen..." should count, "-10 to Strength" should not.
  return /^- [A-Za-z]/.test(s);
}

function looksLikeModLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;

  // digits/% almost certainly means stats
  if (/[0-9]/.test(s)) return true;
  if (s.includes("%")) return true;

  // common mod verbs/terms (NOTE: deliberately NOT including "to")
  return /\b(adds|increased|reduced|more|less|chance|resistance|damage|armour|evasion|energy shield|gain|cannot|skills|modifiers|maximum|minimum)\b/i.test(
    s
  );
}
