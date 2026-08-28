# TikTok 日报图片 Design QA

- Source visual truth: `/Users/guangyu/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_41vq2zkdetg211_7081/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/e6afe0cf5693c56c2a19282cfd2dd822.png`
- Implementation: `/Users/guangyu/Desktop/AlphaPercept_2026-08-27_个股热榜_TikTok.png`
- Hotspot implementation: `/Users/guangyu/Desktop/AlphaPercept_2026-08-27_当日热点_TikTok.png`
- Full-view comparison: `/tmp/design-qa-hotlist-side-by-side.png`
- Focused comparison: `/tmp/design-qa-hotlist-focused.png`
- Viewport/output: 1080 × 1920 px, 1× PNG, intended for TikTok portrait upload and phone-screen viewing.
- Normalization: source 1320 × 2868 px was aspect-fitted and padded to 1080 × 1920; implementation remained native 1080 × 1920. The comparison canvas is 2160 × 1920.
- State: 2026-08-27 close archive, populated stock inflow/outflow and hot-money data.

## Findings

No actionable P0/P1/P2 findings remain.

- Fonts and typography: Noto Sans SC static weight renders Chinese and figures sharply. Primary titles, stock names, amounts, hot-money labels, watermark and disclaimer remain readable at phone scale. Long hot-money names stay on one line; the `净 / 买 / 卖` amount line no longer wraps units.
- Spacing and layout rhythm: the reference demonstrates dense mobile-first financial information. The implementation intentionally lowers density, uses two ranked columns and six hot-money cards, and preserves a clear footer safe area. Section widths, card gutters and baselines are balanced.
- Colors and visual tokens: approved Pantone light-report palette is retained. Dark ink and cream paper provide stronger contrast than the source capture; red and teal are reserved for buy/sell semantics.
- Image quality and asset fidelity: server output is a native 1080 × 1920 PNG, not a PDF screenshot. Text edges are sharp, there are no scaling halos, and the 279 KB file is suitable for social upload.
- Copy and content: the output uses plain labels (`个股热榜`, `个股资金榜`, `游资席位榜`, `主要买入`) and keeps the watermark and investment disclaimer visible.

## Comparison history

1. Earlier P1: eight hot-money cards overflowed into the disclaimer. Fix: share edition reduced to six ranked cards while retaining sixteen stock rows. Post-fix evidence: final implementation and full-view comparison.
2. Earlier P2: the tenth hotspot card overlapped the footer. Fix: reduced internal card padding, tightened row gaps and distributed ten cards across the available height without shrinking title text. Post-fix evidence: final hotspot implementation.
3. Earlier P2: long hot-money names and amount units wrapped unpredictably. Fix: name receives an exclusive no-wrap line; `净 / 买 / 卖` occupies a second no-wrap line; major purchases occupy a third line. Post-fix evidence: focused comparison.

## Open questions

- None for the current two-image publishing cadence. Morning reports map to `当日热点`; close reports map to `个股热榜`.

## Implementation checklist

- [x] Two 1080 × 1920 PNG export types.
- [x] Ten-item morning hotspot poster.
- [x] Combined stock and hot-money close poster.
- [x] Mobile-readable Chinese font and high contrast.
- [x] Watermark and disclaimer always visible.
- [x] No user-facing PDF export controls.

## Follow-up polish

- P3: after several days of real posting, adjust the six-card hot-money cutoff only if typical labels or purchase summaries become materially longer.

final result: passed
