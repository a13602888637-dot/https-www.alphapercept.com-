const PINYIN_BOUNDARIES: Array<[string, string]> = [
  ["A", "阿"], ["B", "芭"], ["C", "擦"], ["D", "搭"], ["E", "蛾"], ["F", "发"], ["G", "噶"],
  ["H", "哈"], ["J", "击"], ["K", "喀"], ["L", "垃"], ["M", "妈"], ["N", "拿"], ["O", "哦"],
  ["P", "啪"], ["Q", "期"], ["R", "然"], ["S", "撒"], ["T", "塌"], ["W", "挖"], ["X", "昔"],
  ["Y", "压"], ["Z", "匝"],
];
const OVERRIDES: Record<string, string> = { 长: "C", 厦: "X" };
const collator = new Intl.Collator("zh-CN-u-co-pinyin");

function initial(character: string): string {
  if (OVERRIDES[character]) return OVERRIDES[character];
  let result = character.toUpperCase();
  for (const [letter, boundary] of PINYIN_BOUNDARIES) {
    if (collator.compare(character, boundary) >= 0) result = letter;
    else break;
  }
  return result;
}

export function compactVideoShareName(value: string): string {
  const cleaned = value.replace(/^\*?ST/iu, "").replace(/股份/gu, "").replace(/股/gu, "").trim();
  const characters = Array.from(cleaned);
  return characters.length > 0 ? `${initial(characters[0])}${characters.slice(1).join("")}` : "--";
}

export function videoShareAmount(value: number): string {
  return `${Math.round(Math.abs(value) / 10_000).toLocaleString("zh-CN")}🥣`;
}

export function compactVideoAccountLabel(value: string): string {
  return value
    .replace(/[（(]散户集合席[）)]/gu, "")
    .replace(/证券营业部/gu, "营业部")
    .replace(/\s+/gu, " ")
    .trim();
}
