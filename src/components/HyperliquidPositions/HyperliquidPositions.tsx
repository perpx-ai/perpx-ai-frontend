import cx from "classnames";
import { t } from "@lingui/macro";
import { useHyperliquidPositions } from "lib/useHyperliquidPositions";

interface Props {
  userAddress: string | undefined;
}

export function HyperliquidPositions({ userAddress }: Props) {
  const { positions, balances, loading } = useHyperliquidPositions(userAddress);

  const accountBalance = balances.find((b) => b.asset === "USDC");

  if (!userAddress) return null;

  return (
    <div className="mt-8">
      {/* HL account summary */}
      {accountBalance && (
        <div className="mb-8 flex items-center gap-16 px-16 py-8 text-body-small text-typography-secondary">
          <span>
            {t`HL Balance:`}{" "}
            <span className="text-typography-primary">
              ${parseFloat(accountBalance.total).toFixed(2)}
            </span>
          </span>
          <span>
            {t`Available:`}{" "}
            <span className="text-typography-primary">
              ${parseFloat(accountBalance.available).toFixed(2)}
            </span>
          </span>
          {parseFloat(accountBalance.unrealizedPnl) !== 0 && (
            <span>
              {t`Unrealized PnL:`}{" "}
              <span
                className={cx(
                  parseFloat(accountBalance.unrealizedPnl) >= 0
                    ? "text-green-500"
                    : "text-red-500"
                )}
              >
                ${parseFloat(accountBalance.unrealizedPnl).toFixed(2)}
              </span>
            </span>
          )}
        </div>
      )}

      {loading && positions.length === 0 ? (
        <div className="px-16 py-12 text-body-small text-typography-secondary">{t`Loading Hyperliquid positions…`}</div>
      ) : positions.length === 0 ? (
        <div className="px-16 py-12 text-body-small text-typography-secondary">{t`No open Hyperliquid positions`}</div>
      ) : (
        <table className="w-full text-body-small">
          <thead>
            <tr className="border-b border-slate-700 text-left text-typography-secondary">
              <th className="px-16 py-8">{t`Market`}</th>
              <th className="px-16 py-8">{t`Side`}</th>
              <th className="px-16 py-8">{t`Size`}</th>
              <th className="px-16 py-8">{t`Entry Price`}</th>
              <th className="px-16 py-8">{t`Mark Price`}</th>
              <th className="px-16 py-8">{t`PnL`}</th>
              <th className="px-16 py-8">{t`Leverage`}</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, i) => {
              const pnl = parseFloat(pos.unrealizedPnl);
              const isLong = pos.side === "LONG";
              return (
                <tr
                  key={i}
                  className="border-b border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-16 py-10 font-medium text-typography-primary">
                    <span className="flex items-center gap-6">
                      <span className="rounded-4 bg-blue-900/40 px-6 py-2 text-[10px] text-blue-400">HL</span>
                      {pos.symbol}/USD
                    </span>
                  </td>
                  <td className="px-16 py-10">
                    <span
                      className={cx(
                        "font-medium",
                        isLong ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {isLong ? t`Long` : t`Short`}
                    </span>
                  </td>
                  <td className="px-16 py-10 text-typography-primary">
                    {pos.size} {pos.symbol}
                  </td>
                  <td className="px-16 py-10 text-typography-primary">
                    ${parseFloat(pos.entryPrice).toLocaleString()}
                  </td>
                  <td className="px-16 py-10 text-typography-primary">
                    {parseFloat(pos.markPrice) > 0
                      ? `$${parseFloat(pos.markPrice).toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-16 py-10">
                    <span className={cx(pnl >= 0 ? "text-green-500" : "text-red-500")}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-16 py-10 text-typography-secondary">
                    {pos.leverage}× {pos.marginMode}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
