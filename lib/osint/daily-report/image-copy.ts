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
