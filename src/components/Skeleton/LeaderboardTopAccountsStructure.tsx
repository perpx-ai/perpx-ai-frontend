import Skeleton from "react-loading-skeleton";

import { TableTd, TableTr } from "components/Table/Table";

export function LeaderboardTopAccountsStructure() {
  return (
    <TableTr>
      <TableTd className="leaderboard-cell-rank">
        <Skeleton width={40} inline />
      </TableTd>
      <TableTd className="leaderboard-cell-address">
        <div className="flex items-center gap-6 py-[1.5px]">
          <Skeleton circle width={20} height={20} inline className="!block" />
          <Skeleton width={120} inline className="!block" />
        </div>
      </TableTd>
      <TableTd className="leaderboard-cell-total text-left">
        <Skeleton width={60} inline />
      </TableTd>
    </TableTr>
  );
}
