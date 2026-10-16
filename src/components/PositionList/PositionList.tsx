import { t, Trans } from "@lingui/macro";
import cx from "classnames";
import { memo, useCallback, useState } from "react";
import { useMedia } from "react-use";

import { useIsPositionsLoading, usePositionsInfoData } from "context/SyntheticsStateContext/hooks/globalsHooks";
import { usePositionEditorPositionState } from "context/SyntheticsStateContext/hooks/positionEditorHooks";
import { selectChainId } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { selectPositionsInfoDataSortedByMarket } from "context/SyntheticsStateContext/selectors/positionsSelectors";
import { selectShowPnlAfterFees } from "context/SyntheticsStateContext/selectors/settingsSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { PositionInfo } from "domain/synthetics/positions";
import { TradeMode } from "domain/synthetics/trade";
import { getByKey } from "lib/objects";
import { userAnalytics } from "lib/userAnalytics";
import { SharePositionClickEvent } from "lib/userAnalytics/types";

import Skeleton from "react-loading-skeleton";
import { EmptyTableContent } from "components/EmptyTableContent/EmptyTableContent";
import { OrderEditorContainer } from "components/OrderEditorContainer/OrderEditorContainer";
import { PositionItem } from "components/PositionItem/PositionItem";
import PositionShare from "components/PositionShare/PositionShare";
import { Table, TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import { useHyperliquidPositions, type HlPosition } from "lib/useHyperliquidPositions";
import { useAuth } from "context/AuthContext/AuthContextProvider";
import { closeHlPosition, placeHlOrder } from "lib/api/hyperliquid";
import { SHOW_POSITION_ACTIONS } from "lib/devFlags";
import { helperToast } from "lib/helperToast";
import Button from "components/Button/Button";
import useWallet from "lib/wallets/useWallet";
import { useCustodyWallet } from "context/CustodyWalletContext/CustodyWalletContextProvider";

export type PositionListTableVariant = "default" | "accountHistory";

type Props = {
  onSelectPositionClick: (key: string, tradeMode?: TradeMode, showCurtain?: boolean) => void;
  onClosePositionClick: (key: string) => void;
  onOrdersClick: (positionKey: string, orderKey: string | undefined) => void;
  onCancelOrder: (key: string) => void;
  openSettings: () => void;
  hideActions?: boolean;
  tableVariant?: PositionListTableVariant;
};

export function PositionList(p: Props) {
  const { onClosePositionClick, onOrdersClick, onSelectPositionClick, onCancelOrder, hideActions, tableVariant = "default" } = p;
  const positionsInfoData = usePositionsInfoData();
  const chainId = useSelector(selectChainId);
  const [isPositionShareModalOpen, setIsPositionShareModalOpen] = useState(false);
  const [positionToShareKey, setPositionToShareKey] = useState<string>();
  const positionToShare = getByKey(positionsInfoData, positionToShareKey);
  const positions = useSelector(selectPositionsInfoDataSortedByMarket);
  const { token } = useAuth();
  const { account } = useWallet();
  const { custodyWalletAddress } = useCustodyWallet();
  const { positions: hlPositions, loading: hlLoading, refetch: refetchHl } = useHyperliquidPositions(custodyWalletAddress ?? account);

  const handleSharePositionClick = useCallback((positionKey: string) => {
    userAnalytics.pushEvent<SharePositionClickEvent>({
      event: "SharePositionAction",
      data: {
        action: "SharePositionClick",
      },
    });
    setPositionToShareKey(positionKey);
    setIsPositionShareModalOpen(true);
  }, []);
  const [, setEditingPositionKey] = usePositionEditorPositionState();
  const isLoading = useIsPositionsLoading();
  const isMobile = useMedia("(max-width: 1024px)");
  const isEmpty = positions.length === 0 && hlPositions.length === 0;

  return (
    <div className="flex grow flex-col">
      {isMobile && (
        <>
          {(isLoading || hlLoading) && isEmpty && (
            <div className="flex flex-col gap-8 p-12">
              {[...Array(3)].map((_, i) => (
                <div key={`skeleton-m-${i}`} className="rounded-8 bg-slate-800 p-12">
                  <Skeleton baseColor="#1e293b" highlightColor="#334155" height={14} count={3} className="mb-4" />
                </div>
              ))}
            </div>
          )}
          <EmptyTableContent
            isLoading={false}
            isEmpty={!isLoading && !hlLoading && isEmpty}
            emptyText={<Trans>No open positions</Trans>}
          />
          <div className="grid grid-cols-1 gap-8 min-[800px]:grid-cols-2">
            {!isLoading &&
                positions.map((position) => (
                  <PositionItemWrapper
                    key={position.key}
                    position={position}
                    onEditCollateralClick={setEditingPositionKey}
                    onClosePositionClick={onClosePositionClick}
                    onOrdersClick={onOrdersClick}
                    onSelectPositionClick={onSelectPositionClick}
                    isLarge={false}
                    onShareClick={handleSharePositionClick}
                    hideActions={hideActions}
                    onCancelOrder={onCancelOrder}
                    tableVariant={tableVariant}
                />
              ))}
            {!hlLoading && hlPositions.map((pos, i) => (
              <HlPositionCard key={`hl-${i}`} position={pos} token={token} onClose={refetchHl} />
            ))}
          </div>
        </>
      )}

      {!isMobile && (
        <TableScrollFadeContainer
          disableScrollFade={positions.length === 0}
          className="flex grow flex-col bg-slate-900"
        >
          <Table className="!w-[max(100%,900px)] table-fixed">
            <thead className="text-body-medium">
              <TableTheadTr>
                {tableVariant === "accountHistory" ? (
                  <>
                    <TableTh className="w-[14%]">
                      <Trans>Symbol</Trans>
                    </TableTh>
                    <TableTh className="w-[14%]">
                      <Trans>Holding</Trans>
                    </TableTh>
                    <TableTh className="w-[16%]">
                      <Trans>Holding Value</Trans>
                    </TableTh>
                    <TableTh className="w-[18%]">
                      <Trans>Unrealized PnL</Trans>
                    </TableTh>
                    <TableTh className="w-[18%]">
                      <Trans>Mark Price</Trans>
                    </TableTh>
                    <TableTh className="w-[18%]">
                      <Trans>Avg Entry Price</Trans>
                    </TableTh>
                  </>
                ) : (
                  <>
                    <TableTh className="w-[18%]">
                      <Trans>Position</Trans>
                    </TableTh>
                    <TableTh className="w-[10%]">
                      <Trans>Size</Trans>
                    </TableTh>
                    <TableTh className="w-[12%]">
                      <Trans>Net Value</Trans>
                    </TableTh>
                    <TableTh className="w-[10%]">
                      <Trans>Collateral</Trans>
                    </TableTh>
                    <TableTh className="w-[10%]">
                      <Trans>Entry Price</Trans>
                    </TableTh>
                    <TableTh className="w-[10%]">
                      <Trans>Mark Price</Trans>
                    </TableTh>
                    <TableTh className="w-[10%]">
                      <Trans>Liq. Price</Trans>
                    </TableTh>
                    <TableTh className="w-[6%]">
                      <Trans>Venue</Trans>
                    </TableTh>
                    {!isLoading && !p.hideActions && (
                      <>
                        <TableTh className="w-[124px]"></TableTh>
                      </>
                    )}
                  </>
                )}
              </TableTheadTr>
            </thead>
            <tbody>
              {(isLoading || hlLoading) && isEmpty && (
                <>
                  {[...Array(3)].map((_, i) => (
                    <TableTr key={`skeleton-${i}`}>
                      {[...Array(tableVariant === "accountHistory" ? 6 : 8)].map((_, j) => (
                        <TableTd key={j}>
                          <Skeleton baseColor="#1e293b" highlightColor="#334155" height={16} />
                        </TableTd>
                      ))}
                    </TableTr>
                  ))}
                </>
              )}
              {!isLoading &&
                positions.map((position) => (
                  <PositionItemWrapper
                    key={position.key}
                    position={position}
                    onEditCollateralClick={setEditingPositionKey}
                    onClosePositionClick={onClosePositionClick}
                    onOrdersClick={onOrdersClick}
                    onSelectPositionClick={onSelectPositionClick}
                    isLarge
                    onShareClick={handleSharePositionClick}
                    hideActions={hideActions}
                    onCancelOrder={onCancelOrder}
                    tableVariant={tableVariant}
                  />
                ))}
              {!hlLoading && hlPositions.map((pos, i) => (
                <HlPositionRow key={`hl-${i}`} position={pos} token={token} onClose={refetchHl} hideActions={hideActions} />
              ))}
            </tbody>
          </Table>

          <EmptyTableContent
            isLoading={isLoading}
            isEmpty={isEmpty}
            emptyText={<Trans>No open positions</Trans>}
          />
        </TableScrollFadeContainer>
      )}
      {positionToShare && (
        <PositionShare
          key={positionToShare.key}
          pnlAfterFeesUsd={positionToShare.pnlAfterFees}
          setIsPositionShareModalOpen={setIsPositionShareModalOpen}
          isPositionShareModalOpen={isPositionShareModalOpen}
          entryPrice={positionToShare.entryPrice}
          indexToken={positionToShare.indexToken}
          isLong={positionToShare.isLong}
          leverageWithoutPnl={positionToShare.leverageWithoutPnl}
          leverageWithPnl={positionToShare.leverageWithPnl}
          markPrice={positionToShare.markPrice}
          account={positionToShare.account}
          pnlAfterFeesPercentage={positionToShare?.pnlAfterFeesPercentage}
          chainId={chainId}
          shareSource="positions-list"
        />
      )}
      <OrderEditorContainer />
    </div>
  );
}

const PositionItemWrapper = memo(
  ({
    position,
    hideActions,
    isLarge,
    onClosePositionClick,
    onEditCollateralClick,
    onOrdersClick,
    onSelectPositionClick,
    onShareClick,
    onCancelOrder,
    tableVariant,
  }: {
    position: PositionInfo;
    onEditCollateralClick: (positionKey: string) => void;
    onClosePositionClick: (positionKey: string) => void;
    onOrdersClick: (positionKey: string, orderKey: string | undefined) => void;
    onSelectPositionClick: (positionKey: string, tradeMode: TradeMode | undefined, showCurtain?: boolean) => void;
    isLarge: boolean;
    onShareClick: (positionKey: string) => void;
    hideActions: boolean | undefined;
    onCancelOrder: (orderKey: string) => void;
    tableVariant?: PositionListTableVariant;
  }) => {
    const showPnlAfterFees = useSelector(selectShowPnlAfterFees);
    const handleEditCollateralClick = useCallback(
      () => onEditCollateralClick(position.key),
      [onEditCollateralClick, position.key]
    );
    const handleClosePositionClick = useCallback(
      () => onClosePositionClick(position.key),
      [onClosePositionClick, position.key]
    );

    const handleSelectPositionClick = useCallback(
      (tradeMode?: TradeMode, showCurtain?: boolean) => onSelectPositionClick(position.key, tradeMode, showCurtain),
      [onSelectPositionClick, position.key]
    );
    const handleShareClick = useCallback(() => onShareClick(position.key), [onShareClick, position.key]);
    const handleCancelOrder = useCallback((orderKey: string) => onCancelOrder(orderKey), [onCancelOrder]);
    const handleOrdersClick = useCallback(
      (orderKey: string | undefined) => {
        onOrdersClick(position.key, orderKey);
      },
      [onOrdersClick, position.key]
    );

    return (
      <PositionItem
        position={position}
        onEditCollateralClick={handleEditCollateralClick}
        onClosePositionClick={handleClosePositionClick}
        onOrdersClick={handleOrdersClick}
        onSelectPositionClick={handleSelectPositionClick}
        showPnlAfterFees={showPnlAfterFees}
        isLarge={isLarge}
        hideActions={hideActions}
        onCancelOrder={handleCancelOrder}
        onShareClick={handleShareClick}
        tableVariant={tableVariant}
      />
    );
  }
);

// ── Hyperliquid close action (shared by the desktop row and the mobile card) ──

function useHlPositionClose(position: HlPosition, token: string | null, onClose: () => void) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(async () => {
    // Without a session token the request cannot be authorized. Say so — a bare
    // early return makes the Close button look broken.
    if (!token) {
      helperToast.error(t`Please sign in to close this position`);
      return;
    }
    setClosing(true);
    try {
      const result = await closeHlPosition(position.symbol, position.size, position.side, token);
      // A market close can rest instead of filling; only claim it closed when it did.
      if (result?.status === "FILLED") {
        helperToast.success(t`Closed ${position.symbol} position`);
      } else {
        helperToast.success(t`Close order placed for ${position.symbol}`);
      }
      onClose();
    } catch (err: any) {
      helperToast.error(err?.message ?? t`Close failed`);
    } finally {
      setClosing(false);
    }
  }, [token, position, onClose]);

  return { closing, handleClose };
}

// ── Hyperliquid limit close (reduce-only GTC limit for the full size) ───────────

function HlLimitClose({
  position,
  token,
  onPlaced,
  className,
}: {
  position: HlPosition;
  token: string | null;
  onPlaced: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [placing, setPlacing] = useState(false);

  const handlePlace = useCallback(async () => {
    if (!token) {
      helperToast.error(t`Please sign in to place this order`);
      return;
    }
    const px = parseFloat(price);
    if (!Number.isFinite(px) || px <= 0) {
      helperToast.error(t`Enter a valid limit price`);
      return;
    }
    setPlacing(true);
    try {
      await placeHlOrder(
        {
          symbol: position.symbol,
          // Closing a long sells, closing a short buys.
          side: position.side === "LONG" ? "SELL" : "BUY",
          type: "LIMIT",
          quantity: position.size,
          price: price.trim(),
          reduceOnly: true,
          timeInForce: "GTC",
          userAddress: "",
        },
        token,
      );
      helperToast.success(t`Limit close placed for ${position.symbol} at $${price.trim()}`);
      setOpen(false);
      setPrice("");
      onPlaced();
    } catch (err: any) {
      helperToast.error(err?.message ?? t`Limit order failed`);
    } finally {
      setPlacing(false);
    }
  }, [token, price, position, onPlaced]);

  if (!open) {
    return (
      <Button
        variant="ghost"
        className={className}
        onClick={() => {
          setPrice(parseFloat(position.markPrice) > 0 ? position.markPrice : "");
          setOpen(true);
        }}
      >
        <Trans>Limit</Trans>
      </Button>
    );
  }

  return (
    <div className={cx("flex items-center gap-4", className)}>
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handlePlace();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t`Price`}
        className="w-96 rounded-4 border border-slate-700 bg-slate-800 px-6 py-4 text-body-small"
      />
      <Button variant="secondary" onClick={handlePlace} disabled={placing}>
        {placing ? t`Placing…` : <Trans>Place</Trans>}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)} disabled={placing}>
        ✕
      </Button>
    </div>
  );
}

// ── Hyperliquid position row (desktop table) ──────────────────────────────────

function HlPositionRow({
  position,
  token,
  onClose,
  hideActions,
}: {
  position: HlPosition;
  token: string | null;
  onClose: () => void;
  hideActions?: boolean;
}) {
  const pnl = parseFloat(position.unrealizedPnl);
  const isLong = position.side === "LONG";
  const { closing, handleClose } = useHlPositionClose(position, token, onClose);

  return (
    <TableTr hoverable={false}>
      <TableTd>
        <div className="flex flex-col gap-2">
          <span className="font-medium">{position.symbol}/USD</span>
          <div className="flex items-center gap-4 text-body-small">
            <span className="muted rounded-2 px-2 pb-1">{position.leverage}×</span>
            <span className={cx({ positive: isLong, negative: !isLong })}>
              {isLong ? t`Long` : t`Short`}
            </span>
          </div>
        </div>
      </TableTd>
      <TableTd>
        <span className="numbers">{position.size} {position.symbol}</span>
      </TableTd>
      <TableTd>
        <span className={cx("numbers", { positive: pnl > 0, negative: pnl < 0, muted: pnl === 0 })}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}
        </span>
      </TableTd>
      <TableTd>
        <span className="numbers">
          {parseFloat(position.collateral) > 0 ? `$${parseFloat(position.collateral).toFixed(2)}` : "—"}
        </span>
      </TableTd>
      <TableTd>
        <span className="numbers">${parseFloat(position.entryPrice).toLocaleString()}</span>
      </TableTd>
      <TableTd>
        <span className="numbers">
          {parseFloat(position.markPrice) > 0 ? `$${parseFloat(position.markPrice).toLocaleString()}` : "—"}
        </span>
      </TableTd>
      <TableTd>
        <span className="numbers">
          {position.liquidationPrice ? `$${parseFloat(position.liquidationPrice).toLocaleString()}` : "—"}
        </span>
      </TableTd>
      <TableTd>
        <span className="rounded-4 bg-[#1a2d1a] px-6 py-2 text-[10px] font-medium text-[#4ade80]">HL</span>
      </TableTd>
      {!hideActions && (
        <TableTd>
          <div className="flex items-center justify-end gap-4">
            {SHOW_POSITION_ACTIONS && <HlLimitClose position={position} token={token} onPlaced={onClose} />}
            <Button variant="ghost" onClick={handleClose} disabled={closing}>
              {closing ? t`Closing…` : <Trans>Close</Trans>}
            </Button>
          </div>
        </TableTd>
      )}
    </TableTr>
  );
}

// ── Hyperliquid position card (mobile) ────────────────────────────────────────

function HlPositionCard({
  position,
  token,
  onClose,
}: {
  position: HlPosition;
  token: string | null;
  onClose: () => void;
}) {
  const pnl = parseFloat(position.unrealizedPnl);
  const isLong = position.side === "LONG";
  const { closing, handleClose } = useHlPositionClose(position, token, onClose);

  return (
    <div className="rounded-8 border border-slate-700 bg-slate-900 p-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="rounded-4 bg-[#1a2d1a] px-6 py-2 text-[10px] font-medium text-[#4ade80]">HL</span>
          <span className="font-medium">{position.symbol}/USD</span>
          <span className={cx("text-body-small", { positive: isLong, negative: !isLong })}>
            {isLong ? t`Long` : t`Short`}
          </span>
          <span className="muted text-body-small">{position.leverage}×</span>
        </div>
      </div>
      <div className="mb-4 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>Size</Trans></span>
        <span>{position.size} {position.symbol}</span>
      </div>
      <div className="mb-4 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>Collateral</Trans></span>
        <span>{parseFloat(position.collateral) > 0 ? `$${parseFloat(position.collateral).toFixed(2)}` : "—"}</span>
      </div>
      <div className="mb-4 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>Entry Price</Trans></span>
        <span>${parseFloat(position.entryPrice).toLocaleString()}</span>
      </div>
      <div className="mb-4 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>Mark Price</Trans></span>
        <span>{parseFloat(position.markPrice) > 0 ? `$${parseFloat(position.markPrice).toLocaleString()}` : "—"}</span>
      </div>
      <div className="mb-4 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>Liq. Price</Trans></span>
        <span>{position.liquidationPrice ? `$${parseFloat(position.liquidationPrice).toLocaleString()}` : "—"}</span>
      </div>
      <div className="mb-8 flex justify-between text-body-small">
        <span className="text-typography-secondary"><Trans>PnL</Trans></span>
        <span className={cx({ positive: pnl > 0, negative: pnl < 0 })}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}
        </span>
      </div>
      {SHOW_POSITION_ACTIONS && (
        <HlLimitClose position={position} token={token} onPlaced={onClose} className="mb-8 w-full justify-center" />
      )}
      <Button variant="ghost" className="w-full" onClick={handleClose} disabled={closing}>
        {closing ? t`Closing…` : <Trans>Close</Trans>}
      </Button>
    </div>
  );
}
