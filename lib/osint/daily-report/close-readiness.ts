import type { LhbSnapshot } from "../../lhb/contracts";
import type { DailyReportEdition } from "./contracts";

interface CloseReportReadinessInput {
  edition: DailyReportEdition;
  reportDate: string;
  lhb: Pick<LhbSnapshot, "status" | "tradeDate">;
}

export function assertCloseReportReady(input: CloseReportReadinessInput): void {
  if (input.edition !== "close") return;

  if (input.lhb.status !== "live") {
    throw new Error(
      `INCOMPLETE_CLOSE_DATA:${input.lhb.status}:龙虎榜数据状态 ${input.lhb.status}，尚未达到出图条件`
    );
  }

  if (input.lhb.tradeDate !== input.reportDate) {
    throw new Error(
      `STALE_CLOSE_DATA:${input.lhb.tradeDate || "missing"}:龙虎榜交易日 ${input.lhb.tradeDate || "未知"} 与报告日期 ${input.reportDate} 不一致`
    );
  }
}
