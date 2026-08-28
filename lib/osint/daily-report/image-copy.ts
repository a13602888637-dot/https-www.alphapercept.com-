export function compactShareHeadline(value: string): string {
  return value
    .replace(/Inside India's AI Ambitions/gi, "印度加速布局人工智能产业")
    .replace(/Bloomberg Tech:\s*Asia/gi, "彭博亚洲科技")
    .replace(/Economic Outlook and Financial Inclusion/gi, "经济前景与金融包容")
    .replace(/Keynote Remarks/gi, "主题演讲")
    .replace(/Beige Book/gi, "褐皮书")
    .replace(/\s+/g, " ")
    .trim();
}

export function isShareHeadlineReady(value: string): boolean {
  const text = compactShareHeadline(value);
  const characters = Array.from(text);
  const hanCount = characters.filter((character) => /\p{Script=Han}/u.test(character)).length;
  return characters.length > 0 && characters.length <= 46 && hanCount >= 6;
}

export function isChineseReadableText(value: string): boolean {
  const characters = Array.from(value);
  const hanCount = characters.filter((character) => /\p{Script=Han}/u.test(character)).length;
  const latinCount = characters.filter((character) => /[A-Za-z]/.test(character)).length;
  const languageCharacters = hanCount + latinCount;
  return hanCount >= 6 && languageCharacters > 0 && hanCount / languageCharacters >= 0.45;
}

export function shareSourceKey(sourceUrl: string | undefined, title: string): string {
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      return `${url.hostname}${url.pathname}`.replace(/\/$/, "").toLowerCase();
    } catch {
      // Fall through to the normalized title for malformed source URLs.
    }
  }
  return compactShareHeadline(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function compactShareLabel(value: string): string {
  const text = value
    .replace(/[（(]散户集合席[）)]/g, "（散户席）")
    .replace(/证券营业部/g, "营业部")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  return characters.length <= 12 ? text : `${characters.slice(0, 11).join("")}…`;
}

interface SharePosterDateInput {
  reportDate: string;
  generatedAt: string;
  tradeDate: string;
}

function shanghaiDate(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function sharePosterDate(
  section: "stories" | "hotlist",
  input: SharePosterDateInput
): string {
  if (section === "stories") {
    return shanghaiDate(input.generatedAt) || input.reportDate;
  }
  return input.tradeDate || input.reportDate;
}
