import { ComponentPropsWithoutRef, ComponentType, FunctionComponent } from "react";
import ReactLoadingSkeleton, { SkeletonTheme } from "react-loading-skeleton";

import AccountPnlSummarySkeletonStructure from "./AccountPnlSummarySkeletonStructure";
import ClaimsHistorySkeletonStructure from "./ClaimsHistorySkeletonStructure";
import GMListSkeletonStructure from "./GMListSkeletonStructure";
import { LeaderboardTopAccountsStructure } from "./LeaderboardTopAccountsStructure";
import { LeaderboardTopPositionsStructure } from "./LeaderboardTopPositionsStructure";
import MarketListSkeletonStructure from "./MarketListSkeletonStructure";
import TradesHistorySkeletonStructure from "./TradesHistorySkeletonStructure";

import "react-loading-skeleton/dist/skeleton.css";
import "./Skeleton.scss";

type Props = {
  count?: number;
  invisible?: boolean;
  Structure: ComponentType;
};

function TableListSkeleton({ count = 10, Structure, invisible = false, ...restProps }: Props) {
  if (invisible) {
    return (
      <SkeletonTheme baseColor="transparent" highlightColor="transparent" enableAnimation={false}>
        {Array.from({ length: count }).map((_, index) => (
          <Structure {...restProps} key={index} />
        ))}
      </SkeletonTheme>
    );
  }

  return (
    <SkeletonTheme baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A">
      {Array.from({ length: count }).map((_, index) => (
        <Structure {...restProps} key={index} />
      ))}
    </SkeletonTheme>
  );
}

/**
 * A single loading bar sized for one table cell.
 *
 * The table-wide skeletons below stand in for a table that has no rows yet.
 * This is for the opposite case: the row is already on screen and one cell's
 * number is still being computed. A bare "…" there reads as a value the cell
 * actually holds, so a column of them looks like data rather than a pending
 * state; a bar is unmistakably neither.
 *
 * It carries its own `SkeletonTheme` because it renders inside a real row
 * rather than under `TableListSkeleton`, which is what supplies those colours
 * to the full-table structures.
 */
export function CellSkeleton({ width = 60 }: { width?: number }) {
  return (
    <SkeletonTheme baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A">
      <ReactLoadingSkeleton width={width} inline />
    </SkeletonTheme>
  );
}

type SkeletonProps<Component extends FunctionComponent> = {
  count?: number;
  invisible?: boolean;
} & ComponentPropsWithoutRef<Component>;

export function MarketListSkeleton(props: SkeletonProps<typeof MarketListSkeletonStructure>) {
  return <TableListSkeleton {...props} Structure={MarketListSkeletonStructure} />;
}

export function GMListSkeleton(props: SkeletonProps<typeof GMListSkeletonStructure>) {
  return <TableListSkeleton {...props} Structure={GMListSkeletonStructure} />;
}

export function TopAccountsSkeleton(props: SkeletonProps<typeof LeaderboardTopAccountsStructure>) {
  return <TableListSkeleton {...props} Structure={LeaderboardTopAccountsStructure} />;
}

export function TopPositionsSkeleton(props: SkeletonProps<typeof LeaderboardTopPositionsStructure>) {
  return <TableListSkeleton {...props} Structure={LeaderboardTopPositionsStructure} />;
}

export function TradesHistorySkeleton(props: SkeletonProps<typeof TradesHistorySkeletonStructure>) {
  return <TableListSkeleton {...props} Structure={TradesHistorySkeletonStructure} />;
}

export function ClaimsHistorySkeleton(props: SkeletonProps<typeof ClaimsHistorySkeletonStructure>) {
  return <TableListSkeleton {...props} Structure={ClaimsHistorySkeletonStructure} />;
}

export function AccountPnlSummarySkeleton(props: SkeletonProps<typeof AccountPnlSummarySkeletonStructure>) {
  return <TableListSkeleton {...props} Structure={AccountPnlSummarySkeletonStructure} />;
}
