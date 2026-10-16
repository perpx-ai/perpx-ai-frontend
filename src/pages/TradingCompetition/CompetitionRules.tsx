import { Trans, t } from "@lingui/macro";
import { ReactNode } from "react";

import { BOARD_POOL_SHARE, getBoardPoolUsd, getRankRewardUsd, LAST_PAID_RANK } from "./competitionRewards";
import {
  COMPETITION_DURATION_DAYS,
  COMPETITION_MIN_DEPOSIT_USD,
  COMPETITION_MIN_QUALIFYING_VOLUME_USD,
  COMPETITION_PRIZE_POOL_USD,
  COMPETITION_RULES_ANCHOR,
} from "./constants";
import type { CompetitionMetric } from "./useCompetitionLeaderboard";

const CARD_CLASS_NAME = `rounded-[clamp(12px,2vw,16px)] border border-white/10 bg-[#0C1E2C]/70
  p-[clamp(14px,3vw,20px)] backdrop-blur-sm`;

const LABEL_CLASS_NAME = "text-[clamp(10px,2.2vw,11px)] font-semibold uppercase tracking-[0.16em] text-[#7a8a9a]";

/**
 * The published competition rules, sitting under the standings on the
 * dashboard.
 *
 * Every figure it states comes from `constants.ts` rather than being typed into
 * the copy, so the prize pool a visitor reads here and the one the rest of the
 * section quotes can never disagree — a rules page that contradicts itself on
 * money is worse than no rules page.
 *
 * One thing is deliberately absent: a token figure for the TGE airdrop. The
 * mechanic is announced, the amount waits on tokenomics.
 */
export default function CompetitionRules() {
  const prizePool = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(COMPETITION_PRIZE_POOL_USD);

  const minDeposit = `$${COMPETITION_MIN_DEPOSIT_USD}`;
  const minQualifyingVolume = `$${COMPETITION_MIN_QUALIFYING_VOLUME_USD}`;

  return (
    <section
      id={COMPETITION_RULES_ANCHOR}
      // -1 so the Rules button can move keyboard focus here without putting a
      // section into the tab order.
      tabIndex={-1}
      // scroll-mt clears the sticky app header when the button above jumps
      // here, so the heading does not land underneath it.
      className="scroll-mt-[88px] min-w-0 focus:outline-none"
      aria-labelledby={`${COMPETITION_RULES_ANCHOR}-heading`}
    >
      <header className="mb-[clamp(14px,2.6vw,22px)]">
        <span className={LABEL_CLASS_NAME}>
          <Trans>Rules & Structure</Trans>
        </span>

        <h2
          id={`${COMPETITION_RULES_ANCHOR}-heading`}
          className="mt-[clamp(6px,1.4vw,10px)] text-[clamp(22px,4.4vw,34px)] font-bold
            leading-[1.15] tracking-[-0.02em] text-white"
        >
          <Trans>PerpX Trading Competition</Trans>
        </h2>

        <p className="mt-[clamp(6px,1.4vw,10px)] max-w-[70ch] text-[clamp(12px,2.4vw,14px)] leading-[1.6] text-[#8296a5]">
          <Trans>
            How the {COMPETITION_DURATION_DAYS}-day competition is scored, who qualifies, and when rewards are paid.
          </Trans>
        </p>
      </header>

      <div className="grid gap-[clamp(10px,2vw,16px)] sm:grid-cols-3">
        <SnapshotCard label={t`Duration`} value={t`${COMPETITION_DURATION_DAYS} days`} />
        <SnapshotCard label={t`Prize pool`} value={t`${prizePool} USDC`} isHighlighted />
        <SnapshotCard label={t`Leaderboards`} value={t`3 in parallel`} />
      </div>

      <div className="mt-[clamp(10px,2vw,16px)] grid gap-[clamp(10px,2vw,16px)] lg:grid-cols-2">
        <RuleCard title={t`Competition snapshot`}>
          <Rule>
            <Trans>
              Three parallel leaderboards — Trading Volume, Notional PnL and % PnL. A trader is ranked on all three.
            </Trans>
          </Rule>
          <Rule>
            <Trans>PerpX perpetual futures trades only. Spot and staking activity does not count anywhere.</Trans>
          </Rule>
          <Rule>
            <Trans>
              A {minDeposit} USDC account balance is required to register.
            </Trans>
          </Rule>
          <Rule>
            <Trans>
              {minQualifyingVolume} notional volume is the minimum to qualify for any reward.
            </Trans>
          </Rule>
          <Rule>
            <Trans>
              Volume-tiered eligibility for private sale access, plus a pro-rata TGE airdrop for qualifying
              participants. Neither is a guaranteed allocation — final terms are confirmed separately.
            </Trans>
          </Rule>
        </RuleCard>

        <RuleCard title={t`Eligibility`}>
          <Rule>
            <Trans>A verified PerpX account, with KYC completed before payout.</Trans>
          </Rule>
          <Rule>
            <Trans>One account per verified wallet or identity. Duplicate or linked accounts are disqualified.</Trans>
          </Rule>
          <Rule>
            <Trans>Only PerpX perp futures trades count toward any leaderboard.</Trans>
          </Rule>
          <Rule>
            <Trans>
              A {minDeposit} USDC minimum balance is required at registration.
            </Trans>
          </Rule>
        </RuleCard>

        <RuleCard title={t`Qualifying & anti-abuse rules`}>
          <Rule>
            <Trans>Wash trades and self-matching between linked accounts are excluded from Volume.</Trans>
          </Rule>
          <Rule>
            <Trans>
              Notional PnL and % PnL are calculated net of deposits and withdrawals — topping up an account cannot
              inflate a rank.
            </Trans>
          </Rule>
          <Rule>
            <Trans>Round-trip trades between the same or linked wallets are excluded from volume.</Trans>
          </Rule>
          <Rule>
            <Trans>Accounts sharing a funding source, IP or device fingerprint may be treated as linked.</Trans>
          </Rule>
          <Rule>
            <Trans>
              Final rank, private sale access and airdrop eligibility are confirmed only after a 3–5 business day
              anti-abuse review once the competition closes.
            </Trans>
          </Rule>
          <Rule>
            <Trans>
              PerpX may disqualify any account showing abusive patterns, including after cash prizes have been paid.
            </Trans>
          </Rule>
        </RuleCard>

        <RuleCard title={t`Payout timing`}>
          <Rule>
            <Trans>Cash prizes are paid in USDC to winners' PerpX accounts within 7 days of the competition close.</Trans>
          </Rule>
          <Rule>
            <Trans>
              Private sale whitelist activation is tied to the actual private sale date, communicated separately.
            </Trans>
          </Rule>
          <Rule>
            <Trans>
              The TGE airdrop mechanic applies from now; the token amount is shared once tokenomics are finalised.
            </Trans>
          </Rule>
        </RuleCard>

      </div>

      <RewardTable prizePool={prizePool} />
    </section>
  );
}

function SnapshotCard({
  label,
  value,
  isHighlighted = false,
}: {
  label: string;
  value: string;
  isHighlighted?: boolean;
}) {
  return (
    <div className={`${CARD_CLASS_NAME} ${isHighlighted ? "!border-[#35B9C0]/30" : ""}`}>
      <div className={LABEL_CLASS_NAME}>{label}</div>
      <div
        className={`mt-[clamp(8px,1.8vw,12px)] text-[clamp(18px,3.4vw,24px)] font-bold leading-[1.15]
          ${isHighlighted ? "text-[#35B9C0]" : "text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RuleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={CARD_CLASS_NAME}>
      <h3 className="text-[clamp(14px,2.8vw,16px)] font-semibold text-white">{title}</h3>

      <div className="mt-[clamp(10px,2vw,14px)] flex flex-col gap-[clamp(8px,1.6vw,11px)]">{children}</div>
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-10">
      <span className="mt-[7px] size-5 shrink-0 rounded-full bg-[#35B9C0]" aria-hidden />
      <span className="text-[clamp(12px,2.4vw,13px)] leading-[1.6] text-[#8296a5]">{children}</span>
    </div>
  );
}


/** Prize money, to the cent — ranks 4-10 land on figures like $196.43. */
function formatReward(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * The confirmed per-rank prize table, one column per board.
 *
 * Every figure is computed from the pool and the published percentages rather
 * than typed in, so this table and the "Est. Reward" column on the standings
 * can never quote different money for the same rank — they are the same
 * function called twice.
 */
function RewardTable({ prizePool }: { prizePool: string }) {
  const boards: { metric: CompetitionMetric; label: string }[] = [
    { metric: "volume", label: t`Volume` },
    { metric: "pnl", label: t`Notional PnL` },
    { metric: "roi", label: t`% PnL` },
  ];

  /** Ranks 4-10 all win the same amount, so they are published as one row. */
  const rows = [1, 2, 3, 4];

  return (
    <div className={`${CARD_CLASS_NAME} mt-[clamp(10px,2vw,16px)]`}>
      <h3 className="text-[clamp(14px,2.8vw,16px)] font-semibold text-white">
        <Trans>Reward structure</Trans>
      </h3>

      <p className="mt-[clamp(6px,1.4vw,10px)] text-[clamp(12px,2.4vw,13px)] leading-[1.6] text-[#8296a5]">
        <Trans>
          The {prizePool} USDC pool is split across the three boards, and the top {LAST_PAID_RANK} of each board are
          paid. A trader is ranked on all three, so one account can win on more than one.
        </Trans>
      </p>

      <div className="mt-[clamp(10px,2vw,16px)] overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr>
              <RewardTh className="!text-left">
                <Trans>Rank</Trans>
              </RewardTh>
              {boards.map((board) => (
                <RewardTh key={board.metric}>{board.label}</RewardTh>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((rank) => (
              <tr key={rank} className="border-t border-white/5">
                <RewardTd className="!text-left !text-white">
                  {rank === 4 ? <Trans>4–{LAST_PAID_RANK} (each)</Trans> : `#${rank}`}
                </RewardTd>
                {boards.map((board) => (
                  <RewardTd key={board.metric}>{formatReward(getRankRewardUsd(board.metric, rank))}</RewardTd>
                ))}
              </tr>
            ))}

            <tr className="border-t border-white/10">
              <RewardTd className="!text-left !font-semibold !text-white">
                <Trans>Board pool</Trans>
              </RewardTd>
              {boards.map((board) => (
                <RewardTd key={board.metric} className="!font-semibold !text-[#35B9C0]">
                  {formatReward(getBoardPoolUsd(board.metric))}
                  <span className="ml-6 text-[10px] font-normal text-[#7a8a9a]">
                    {Math.round(BOARD_POOL_SHARE[board.metric] * 100)}%
                  </span>
                </RewardTd>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-[clamp(8px,1.6vw,12px)] text-[clamp(11px,2.2vw,12px)] leading-[1.6] text-[#7a8a9a]">
        <Trans>
          Ranks 1, 2 and 3 take 20%, 15% and 10% of their board's pool; ranks 4–{LAST_PAID_RANK} split the remainder
          evenly. Ties are broken by who registered first.
        </Trans>
      </p>
    </div>
  );
}

function RewardTh({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-8 py-8 text-right text-[clamp(10px,2.2vw,11px)] font-semibold uppercase
        tracking-[0.14em] text-[#7a8a9a] ${className}`}
    >
      {children}
    </th>
  );
}

function RewardTd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-8 py-10 text-right text-[clamp(12px,2.4vw,13px)] tabular-nums text-[#8296a5] ${className}`}>
      {children}
    </td>
  );
}
