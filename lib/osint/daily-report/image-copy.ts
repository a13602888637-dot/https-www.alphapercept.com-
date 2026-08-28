export function compactShareHeadline(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  return characters.length <= 46 ? text : `${characters.slice(0, 45).join("")}…`;
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
