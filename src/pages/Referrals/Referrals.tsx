import { Trans, msg, t } from "@lingui/macro";
import { ethers } from "ethers";
import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLocalStorage } from "react-use";
import { REFERRALS_SELECTED_TAB_KEY } from "config/localStorage";
import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import {
  ReferralCodeStats,
  registerReferralCode,
  useAffiliateTier,
  useCodeOwner,
  useReferralsData,
  useReferrerDiscountShare,
  useUserReferralCode,
} from "domain/referrals";
import { useChainId } from "lib/chains";
import { useLocalizedMap } from "lib/i18n";
import { getPageTitle, isHashZero } from "lib/legacy";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { serializeBigIntsInObject } from "lib/numbers";
import useWallet from "lib/wallets/useWallet";

import AppPageLayout from "components/AppPageLayout/AppPageLayout";
import Loader from "components/Common/Loader";
import SEO from "components/Common/SEO";
import Footer from "components/Footer/Footer";
import PageTitle from "components/PageTitle/PageTitle";
import AddAffiliateCode from "components/Referrals/AddAffiliateCode";
import AffiliatesStats from "components/Referrals/AffiliatesStats";
import JoinReferralCode from "components/Referrals/JoinReferralCode";
import { deserializeSampleStats, isRecentReferralCodeNotExpired } from "components/Referrals/referralsHelper";
import TradersStats from "components/Referrals/TradersStats";
import "./Referrals.css";
import moment from "moment";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import { TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";
import { TooltipPosition } from "components/Tooltip/Tooltip";
import { SortDirection } from "context/SorterContext/types";
import { Sorter } from "components/Sorter/Sorter";
import AddressView from "components/AddressView/AddressView";
import { BottomTablePagination } from "components/Pagination/BottomTablePagination";
import { TopAccountsSkeleton } from "components/Skeleton/Skeleton";
import { BACKEND_URL } from "config/perpx";

const TRADERS = "Traders";
const AFFILIATES = "Affiliates";
const TAB_OPTIONS = [TRADERS, AFFILIATES];
const TAB_OPTION_LABELS = { [TRADERS]: msg`Traders`, [AFFILIATES]: msg`Affiliates` };

function Referrals() {
  const { active, account: walletAccount, signer } = useWallet();
  const { account: queryAccount } = useParams<{ account?: string }>();
  let account;
  if (queryAccount && ethers.isAddress(queryAccount)) {
    account = ethers.getAddress(queryAccount);
  } else {
    account = walletAccount;
  }
  const { chainId } = useChainId();
  const [activeTab, setActiveTab] = useLocalStorage(REFERRALS_SELECTED_TAB_KEY, TRADERS);
  const [recentlyAddedCodes, setRecentlyAddedCodes] = useLocalStorageSerializeKey<ReferralCodeStats[]>(
    [chainId, "REFERRAL", account],
    [],
    {
      raw: false,
      deserializer: deserializeSampleStats as any,
      serializer: (value) => {
        return JSON.stringify(serializeBigIntsInObject(value));
      },
    }
  );
  const { data: referralsData, loading } = useReferralsData(account);
  const { userReferralCode, userReferralCodeString } = useUserReferralCode(signer, chainId, account);
  const { codeOwner } = useCodeOwner(signer, chainId, account, userReferralCode);
  const { affiliateTier: traderTier } = useAffiliateTier(signer, chainId, codeOwner);
  const { discountShare } = useReferrerDiscountShare(signer, chainId, codeOwner);
  const { pendingTxns } = usePendingTxns();
  const localizedTabOptionLabels = useLocalizedMap(TAB_OPTION_LABELS);

  function handleCreateReferralCode(referralCode) {
    return registerReferralCode(chainId, referralCode, signer, {
      sentMsg: t`Referral code submitted!`,
      failMsg: t`Referral code creation failed.`,
      pendingTxns,
    });
  }

  function renderAffiliatesTab() {
    const ownsSomeChainCode = Boolean(referralsData?.chains?.[chainId]?.codes?.length);

    const hasRecentCode = recentlyAddedCodes?.some(isRecentReferralCodeNotExpired);
    const isSomeReferralCodeAvailable = ownsSomeChainCode || hasRecentCode;

    if (loading) return <Loader />;
    if (account && isSomeReferralCodeAvailable) {
      return (
        <AffiliatesStats
          referralsData={referralsData}
          handleCreateReferralCode={handleCreateReferralCode}
          setRecentlyAddedCodes={setRecentlyAddedCodes}
          recentlyAddedCodes={recentlyAddedCodes}
          chainId={chainId}
        />
      );
    } else {
      return (
        <AddAffiliateCode
          handleCreateReferralCode={handleCreateReferralCode}
          active={active}
          recentlyAddedCodes={recentlyAddedCodes}
          setRecentlyAddedCodes={setRecentlyAddedCodes}
        />
      );
    }
  }

  const tabsOptions = useMemo(() => {
    return TAB_OPTIONS.map((option) => ({
      value: option,
      label: localizedTabOptionLabels[option],
    }));
  }, [localizedTabOptionLabels]);

  function renderTradersTab() {
    if (loading) return <Loader />;
    if (isHashZero(userReferralCode) || !account || !userReferralCode) {
      return <JoinReferralCode active={active} />;
    }
    return (
      <TradersStats
        userReferralCodeString={userReferralCodeString}
        chainId={chainId}
        referralsData={referralsData}
        traderTier={traderTier}
        discountShare={discountShare}
      />
    );
  }

  const [referralData, setReferralData] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  async function fetchReferralData() {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin/leaderboard/point-history/${account}?page=${page}&limit=10&type=referal`
      );
      const result = await response.json();
      console.log("%c Line:141 🥖 result", "color:#f5ce50", result);
      if (result?.status && result?.data) {
        setReferralData(result?.data?.leaderboards);
        setPageCount(result?.data?.pagination?.page);
      }
    } catch (error) {
      console.error("Error fetching referral data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (account) {
      fetchReferralData();
    } else {
      setReferralData([]);
    }
  }, [account, page]);

  const TableHeaderCell = memo(
    ({
      breakpoint,
      title,
      direction,
      onChange,
      tooltip,
      tooltipPosition,
      width,
    }: {
      title: string;
      tooltip?: ReactNode;
      tooltipPosition?: TooltipPosition;
      direction?: SortDirection;
      onChange?: (direction: SortDirection) => void;
      width?: number | ((breakpoint?: string) => number);
      breakpoint?: string;
    }) => {
      const style =
        width !== undefined
          ? {
              width: `${typeof width === "function" ? width(breakpoint) : width}%`,
            }
          : undefined;

      const stopPropagation = useCallback((e) => e.stopPropagation(), []);

      const isSortable = !!onChange;

      if (isSortable) {
        return (
          <TableTh style={style}>
            <Sorter direction={direction!} onChange={onChange}>
              {tooltip ? (
                <TooltipWithPortal
                  handle={<span className="whitespace-nowrap">{title}</span>}
                  position={tooltipPosition || "bottom"}
                  content={<div onClick={stopPropagation}>{tooltip}</div>}
                />
              ) : (
                <span className="whitespace-nowrap">{title}</span>
              )}
            </Sorter>
          </TableTh>
        );
      }

      return (
        <TableTh style={style}>
          {tooltip ? (
            <TooltipWithPortal
              handle={<span className="whitespace-nowrap">{title}</span>}
              position={tooltipPosition || "bottom"}
              content={<div onClick={stopPropagation}>{tooltip}</div>}
            />
          ) : (
            <span className="whitespace-nowrap">{title}</span>
          )}
        </TableTh>
      );
    }
  );

  const TableRow = memo(({ account }: any) => {
    return (
      <TableTr bordered={false} key={account?.address} className={"text-body-medium"}>
        <TableTd>
          <AddressView size={20} address={account?.reffarBy} breakpoint="XL" />
        </TableTd>

        <TableTd>{account?.points ? account?.points : "0"}</TableTd>
        <TableTd className="text-right">{moment(account?.createdAt)?.format("DD-MM-YYYY hh:mm A")}</TableTd>
      </TableTr>
    );
  });

  const EmptyRow = memo(() => {
    return (
      <TableTr hoverable={false} bordered={false} className="h-47">
        <TableTd colSpan={3} className="align-top text-slate-100">
          No referral found
        </TableTd>
      </TableTr>
    );
  });

  const content = isLoading ? (
    <TopAccountsSkeleton count={10} />
  ) : (
    <>
      {referralData?.length > 0 ? (
        referralData?.map((account: any, index) => {
          return <TableRow account={account} />;
        })
      ) : (
        <EmptyRow />
      )}
      {referralData?.length < 10 && <TopAccountsSkeleton invisible count={10 - referralData?.length} />}
    </>
  );

  return (
    <AppPageLayout>
      <SEO title={getPageTitle(t`Referrals`)}>
        <div className="mx-auto max-w-[1200px] px-16 py-32">
          <PageTitle isTop title={`Referrals`} qa="referrals-page" />
          {activeTab === AFFILIATES ? renderAffiliatesTab() : renderTradersTab()}

          <div className="mt-12 rounded-4 bg-slate-800">
            <div className="TableBox__head"></div>
            <TableScrollFadeContainer>
              <table className="w-full min-w-[300px]">
                <thead>
                  <TableTheadTr bordered className="text-body-medium">
                    <TableHeaderCell title={t`Address`} tooltipPosition="bottom-end" />
                    <TableHeaderCell title={`Points`} tooltipPosition="bottom-end" />
                    <TableHeaderCell title={`Time`} tooltipPosition="bottom-end" />
                  </TableTheadTr>
                </thead>
                <tbody>
                  {referralData?.length > 0 ? (
                    referralData?.map((account: any, index) => {
                      return <TableRow account={account} />;
                    })
                  ) : (
                    <EmptyRow />
                  )}
                </tbody>
              </table>
            </TableScrollFadeContainer>
            <BottomTablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </div>
        </div>
        <Footer />
      </SEO>
    </AppPageLayout>
  );
}

export default Referrals;
