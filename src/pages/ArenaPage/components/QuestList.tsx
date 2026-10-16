import { Trans } from "@lingui/macro";
import { useState, useEffect } from "react";
import cx from "classnames";
import { motion, AnimatePresence } from "framer-motion";
import { ArenaQuest } from "domain/arena";
import { useArena, ClaimOutcome } from "context/ArenaContext/ArenaContext";
import useWallet from "lib/wallets/useWallet";
import { getStoredAuthToken } from "lib/api/authSession";
import { BACKEND_URL, TELEGRAM_BOT_USERNAME } from "config/perpx";

function EmbeddedTweet({ tweetId }: { tweetId: string }) {
  return (
    <iframe
      src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true`}
      className="w-full rounded-8 border-0"
      style={{ height: "320px" }}
      loading="lazy"
      scrolling="no"
      title="tweet"
    />
  );
}


const KIND_META: Record<ArenaQuest["kind"], { label: string; color: string }> = {
  DAILY_CHECKIN:          { label: "Daily",      color: "bg-green-500/15 text-green-500" },
  SOCIAL_TWITTER:         { label: "Twitter",    color: "bg-[#3FB5FF]/15 text-[#3FB5FF]" },
  SOCIAL_TELEGRAM:        { label: "Telegram",   color: "bg-[#3FB5FF]/15 text-[#3FB5FF]" },
  SOCIAL_DISCORD:         { label: "Discord",    color: "bg-[#5865F2]/15 text-[#5865F2]" },
  TIME_ATTACK:            { label: "Time Attack",color: "bg-[#FFB347]/15 text-[#FFB347]" },
  LEVEL_UP:               { label: "Level Up",   color: "bg-[#FF6A88]/15 text-[#FF6A88]" },
  STAKING:                { label: "Staking",    color: "bg-[#00F5D4]/15 text-[#00F5D4]" },
  DAILY_TRADE_ASSET:      { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_VOLUME:     { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_COUNT:      { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_BOTH_SIDES: { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_PROFIT:     { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_DIVERSITY:  { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_HIGH_STAKES:{ label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_TRADE_SPEED:      { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  DAILY_COMMENT_TWITTER:  { label: "Daily",      color: "bg-orange-500/15 text-orange-400" },
  COMMUNITY_PHOTO:        { label: "Community",  color: "bg-purple-500/15 text-purple-400" },
};

/** Extract tweet ID from a twitter.com or x.com URL */
function extractTweetId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function DailyRefreshCountdown({ refreshesAt }: { refreshesAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(refreshesAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Refreshing..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [refreshesAt]);
  return (
    <span className="flex items-center gap-6 text-[11px] text-slate-400">
      <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-orange-400" />
      Refreshes in {timeLeft}
    </span>
  );
}

export function QuestList() {
  const { quests, claimQuest, loading } = useArena();

  const dailyQuests = quests.filter((q) => q.isDynamic === true);
  const regularQuests = quests.filter((q) => q.isDynamic !== true);

  const twitter = regularQuests.filter((q) => q.kind === "SOCIAL_TWITTER");
  const social = regularQuests.filter(
    (q) =>
      q.kind === "DAILY_CHECKIN" ||
      q.kind === "SOCIAL_TELEGRAM" ||
      q.kind === "SOCIAL_DISCORD"
  );
  const timed = regularQuests.filter((q) => q.kind === "TIME_ATTACK");
  const levels = regularQuests.filter((q) => q.kind === "LEVEL_UP");
  const staking = regularQuests.filter((q) => q.kind === "STAKING");

  return (
    <div className="flex flex-col gap-20">
      {dailyQuests.length > 0 && (
        <div className="flex flex-col gap-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-400">
                Daily Quests
              </span>
              <span className="rounded-full bg-orange-500/10 px-8 py-2 text-[10px] font-bold text-orange-400">
                {dailyQuests.filter((q) => q.status !== "CLAIMED").length} remaining
              </span>
            </div>
            {dailyQuests[0]?.refreshesAt && (
              <DailyRefreshCountdown refreshesAt={dailyQuests[0].refreshesAt} />
            )}
          </div>
          <motion.div
            className="grid gap-12 md:grid-cols-2 xl:grid-cols-3"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {dailyQuests.map((q) => (
              <QuestCard key={q.key} quest={q} onClaim={claimQuest} loading={loading} />
            ))}
          </motion.div>
        </div>
      )}
      <QuestGroup title={<Trans>Daily & Social</Trans>} quests={social} onClaim={claimQuest} loading={loading} />
      <QuestGroup
        title={<Trans>X / Twitter</Trans>}
        quests={twitter}
        onClaim={claimQuest}
        loading={loading}
      />
      <QuestGroup title={<Trans>Staking</Trans>} quests={staking} onClaim={claimQuest} loading={loading} />
      <QuestGroup title={<Trans>Time-Attack</Trans>} quests={timed} onClaim={claimQuest} loading={loading} />
      <QuestGroup title={<Trans>Level-Up Milestones</Trans>} quests={levels} onClaim={claimQuest} loading={loading} />
    </div>
  );
}

function QuestGroup({
  title,
  quests,
  onClaim,
  loading,
  gridClassName,
}: {
  title: React.ReactNode;
  quests: ArenaQuest[];
  onClaim: (key: string, ctx?: any) => Promise<ClaimOutcome>;
  loading: boolean;
  gridClassName?: string;
}) {
  if (!quests.length) return null;
  return (
    <div>
      <h3 className="text-h2 mb-12 font-bold text-white">{title}</h3>
      <motion.div
        className={gridClassName || "grid gap-12 md:grid-cols-2 xl:grid-cols-3"}
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {quests.map((q) => (
          <QuestCard key={q.key} quest={q} onClaim={onClaim} loading={loading} />
        ))}
      </motion.div>
    </div>
  );
}

function QuestCard({
  quest,
  onClaim,
  loading,
}: {
  quest: ArenaQuest;
  onClaim: (key: string, ctx?: any) => Promise<ClaimOutcome>;
  loading: boolean;
}) {
  const meta = KIND_META[quest.kind];
  const { account } = useWallet();
  const { telegramLinked, twitterLinked, discordLinked, refreshTelegramLinked, refreshTwitterLinked, refreshDiscordLinked } = useArena();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<null | "success" | "error">(null);
  const isTelegram = quest.kind === "SOCIAL_TELEGRAM";
  const isTwitter = quest.kind === "SOCIAL_TWITTER";
  const isDiscord = quest.kind === "SOCIAL_DISCORD";

  const tweetId = extractTweetId(quest.target?.tweetUrl);

  const handleClick = async () => {
    setBusy(true);
    try {
      let ctx: any;
      if (quest.kind === "SOCIAL_TWITTER") ctx = undefined; // backend uses stored TwitterLink
      if (quest.kind === "SOCIAL_TELEGRAM") ctx = undefined;
      const outcome = await onClaim(quest.key, ctx);
      setFlash(outcome.success ? "success" : "error");
      setTimeout(() => setFlash(null), 1200);
    } finally {
      setBusy(false);
    }
  };

  const handleSocialVerify = async () => {
    setBusy(true);
    try {
      if (isTelegram) await refreshTelegramLinked();
      if (isTwitter) await refreshTwitterLinked();
      if (isDiscord) await refreshDiscordLinked();
      const outcome = await onClaim(quest.key);
      setFlash(outcome.success ? "success" : "error");
      setTimeout(() => setFlash(null), 1200);
    } finally {
      setBusy(false);
    }
  };

  const isCheckin = quest.kind === "DAILY_CHECKIN";
  const isDailyTrading = quest.kind.startsWith("DAILY_") && quest.kind !== "DAILY_CHECKIN" && quest.kind !== "DAILY_COMMENT_TWITTER";
  const claimedToday = isCheckin && quest.lastClaimedAt
    ? (Date.now() - new Date(quest.lastClaimedAt).getTime()) < 24 * 60 * 60 * 1000
    : false;
  const claimed = quest.status === "CLAIMED" || claimedToday;

  const telegramBotLink = account && TELEGRAM_BOT_USERNAME
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${account}`
    : undefined;

  const twitterAuthUrl = account
    ? `${BACKEND_URL}/api/twitter/auth?address=${account}`
    : undefined;

  const discordAuthUrl = account
    ? `${BACKEND_URL}/api/discord/auth?address=${account}`
    : undefined;

  const retweetIntentUrl = tweetId
    ? `https://twitter.com/intent/retweet?tweet_id=${tweetId}`
    : undefined;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={cx(
        "relative flex flex-col gap-10 overflow-hidden rounded-8 border-1/2 bg-slate-800 p-14 transition-colors",
        claimed ? "border-green-500/40" : "border-slate-600 hover:border-slate-500"
      )}
    >
      <AnimatePresence>
        {flash === "success" && (
          <motion.div
            key="ok"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-green-500/15 backdrop-blur-[1px]"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -10 }}
              animate={{ scale: 1.05, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14 }}
              className="rounded-full bg-green-500 px-16 py-6 text-h2 font-bold text-slate-900 shadow-[0_0_30px_rgba(15,222,141,0.6)]"
            >
              ✓
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <span className={cx("rounded-full px-8 py-2 text-caption uppercase", meta.color)}>
            {meta.label}
          </span>
          <h4 className="mt-8 truncate text-body-large font-bold text-white">{quest.title}</h4>
          <p className="mt-2 text-body-small leading-snug text-slate-100 opacity-70">
            {quest.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-caption">
        <Reward icon="✦" value={`${quest.reward.xp} XP`} />
        {!!quest.reward.raffleTickets && <Reward icon="🎟" value={`${quest.reward.raffleTickets}`} />}
        {!!quest.reward.letters?.length && <Reward icon="🔤" value={quest.reward.letters.join(" ")} />}
      </div>

      {/* Twitter quest: embed tweet + connect + repost + verify */}
      {isTwitter && !claimed && (
        <div className="flex flex-col gap-8">
          {/* Embedded tweet (compact, scrollable if long) */}
          {tweetId && (
            <div className="overflow-hidden rounded-8 border-1/2 border-slate-700">
              <EmbeddedTweet tweetId={tweetId} />
            </div>
          )}

          {/* Connect Twitter */}
          {!twitterLinked.connected ? (
            <a
              href={twitterAuthUrl}
              className={cx(
                "flex items-center justify-center gap-6 rounded-full px-14 py-8 text-body-small font-semibold transition-colors",
                "bg-black text-white border-1/2 border-slate-600 hover:border-slate-400"
              )}
            >
              <XIcon />
              <Trans>Connect X</Trans>
            </a>
          ) : (
            <span className="flex items-center justify-center gap-6 text-body-small text-green-500">
              <XIcon />
              <Trans>Connected as @{twitterLinked.username}</Trans>
            </span>
          )}

          {/* Repost button */}
          {retweetIntentUrl && (
            <a
              href={retweetIntentUrl}
              target="_blank"
              rel="noreferrer"
              className={cx(
                "flex items-center justify-center gap-6 rounded-full px-14 py-8 text-body-small font-semibold transition-colors",
                "bg-[#1D9BF0] text-white hover:bg-[#1A8CD8]"
              )}
            >
              <RetweetIcon />
              <Trans>Repost</Trans>
            </a>
          )}
        </div>
      )}

      {/* Telegram quest */}
      {isTelegram && !claimed && (
        <div className="flex flex-col gap-8">
          {!telegramLinked ? (
            <a
              href={telegramBotLink}
              target="_blank"
              rel="noreferrer"
              className={cx(
                "flex items-center justify-center gap-6 rounded-full px-14 py-8 text-body-small font-semibold transition-colors",
                "bg-[#2AABEE] text-white hover:bg-[#229ED9]"
              )}
            >
              <TelegramIcon />
              <Trans>Join</Trans>
            </a>
          ) : (
            <span className="flex items-center justify-center gap-6 text-body-small text-green-500">
              <TelegramIcon />
              <Trans>Connected</Trans>
            </span>
          )}
        </div>
      )}

      {/* Discord quest: OAuth connect → verify guild membership */}
      {isDiscord && !claimed && (
        <div className="flex flex-col gap-8">
          {quest.target?.discordUrl && (
            <a
              href={quest.target.discordUrl}
              target="_blank"
              rel="noreferrer"
              className={cx(
                "flex items-center justify-center gap-6 rounded-full px-14 py-8 text-body-small font-semibold transition-colors",
                "bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 hover:bg-[#5865F2]/30"
              )}
            >
              <DiscordIcon />
              <Trans>Join Server</Trans>
            </a>
          )}
          {!discordLinked.connected ? (
            <a
              href={discordAuthUrl}
              className={cx(
                "flex items-center justify-center gap-6 rounded-full px-14 py-8 text-body-small font-semibold transition-colors",
                "bg-[#5865F2] text-white hover:bg-[#4752C4]"
              )}
            >
              <DiscordIcon />
              <Trans>Connect Discord</Trans>
            </a>
          ) : (
            <span className="flex items-center justify-center gap-6 text-body-small text-green-500">
              <DiscordIcon />
              <Trans>Connected as {discordLinked.username}</Trans>
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex justify-end pt-4">
        {(isTelegram || isTwitter || isDiscord) && !isDailyTrading && !claimed ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={!busy ? { scale: 1.03 } : undefined}
            disabled={busy || loading}
            onClick={handleSocialVerify}
            className={cx(
              "rounded-full px-14 py-6 text-caption font-semibold uppercase tracking-wide transition-colors",
              busy
                ? "bg-green-500/60 text-slate-900"
                : "bg-green-500 text-slate-900 hover:bg-[#2ff2a3] shadow-[0_0_12px_rgba(15,222,141,0.35)]"
            )}
          >
            {busy ? <Trans>Verifying…</Trans> : <Trans>Verify</Trans>}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={!claimed && !busy ? { scale: 1.03 } : undefined}
            disabled={claimed || busy || loading}
            onClick={handleClick}
            className={cx(
              "rounded-full px-14 py-6 text-caption font-semibold uppercase tracking-wide transition-colors",
              claimed
                ? "bg-slate-700 text-slate-100 opacity-60"
                : busy
                  ? "bg-green-500/60 text-slate-900"
                  : "bg-green-500 text-slate-900 hover:bg-[#2ff2a3] shadow-[0_0_12px_rgba(15,222,141,0.35)]"
            )}
          >
            {claimed ? <Trans>Claimed ✓</Trans> : busy ? <Trans>Claiming…</Trans> : <Trans>Claim</Trans>}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RetweetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2h6v2h-6c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H10.5V4h6c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function Reward({ icon, value }: { icon: string; value: string }) {
  return (
    <span className="rounded-full bg-slate-700 px-8 py-2 text-slate-100">
      {icon} {value}
    </span>
  );
}

// ─── Community Quests ────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadModal({
  quest,
  address,
  onClose,
  onSuccess,
}: {
  quest: ArenaQuest;
  address: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const token = getStoredAuthToken();
      const fd = new FormData();
      fd.append("questKey", quest.key);
      fd.append("caption", caption);
      fd.append("image", file);
      const res = await fetch(`${BACKEND_URL}/api/arena/community-submit`, {
        method: "POST",
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!data.status) throw new Error(data.message || "Submission failed");
      onSuccess();
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-16"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-12 border border-slate-600 bg-slate-900 p-24 shadow-2xl">
        {submitted ? (
          <div className="flex flex-col items-center gap-16 py-16 text-center">
            <div className="flex h-56 w-56 items-center justify-center rounded-full bg-yellow-500/15">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-yellow-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <p className="text-body-large font-bold text-white">Submitted!</p>
              <p className="mt-6 text-body-small text-slate-400">
                Your image is waiting for approval. You'll earn your reward once the team reviews and approves it.
              </p>
            </div>
            <div className="w-full rounded-8 border border-yellow-500/20 bg-yellow-500/10 px-16 py-10">
              <p className="text-caption font-semibold text-yellow-400">Waiting for approval</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-slate-700 px-16 py-10 text-caption font-semibold text-white transition-colors hover:bg-slate-600"
            >
              Done
            </button>
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="mb-20 flex items-start justify-between gap-12">
          <div>
            <span className="rounded-full bg-purple-500/15 px-8 py-2 text-caption uppercase text-purple-400">
              Community
            </span>
            <h3 className="mt-8 text-body-large font-bold text-white">{quest.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-4 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop zone / preview */}
        {!preview ? (
          <label
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center gap-10 rounded-8 border-2 border-dashed py-32 transition-colors",
              dragging
                ? "border-purple-400 bg-purple-500/10"
                : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span className="text-slate-400"><UploadIcon /></span>
            <div className="text-center">
              <p className="text-body-small font-semibold text-slate-200">Click or drag image here</p>
              <p className="mt-2 text-caption text-slate-500">PNG, JPG, GIF up to 1 MB</p>
            </div>
          </label>
        ) : (
          <div className="relative mb-4 overflow-hidden rounded-8">
            <img
              src={preview}
              alt="preview"
              className="w-full object-cover"
              style={{ maxHeight: "200px" }}
            />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute right-8 top-8 rounded-full bg-slate-900/80 p-4 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Caption */}
        <div className="mt-16">
          <label className="mb-6 block text-caption text-slate-400">
            Add a caption (optional)
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-8 border border-slate-600 bg-slate-800 px-12 py-8 text-body-small text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-purple-400"
            placeholder="Describe your submission…"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mt-8 rounded-6 bg-red-500/10 px-12 py-8 text-caption text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-20 flex gap-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-600 px-16 py-8 text-caption font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            whileHover={!loading && !!file ? { scale: 1.02 } : undefined}
            disabled={!file || loading}
            onClick={submit}
            className={cx(
              "flex-1 rounded-full px-16 py-8 text-caption font-semibold uppercase tracking-wide transition-colors",
              !file || loading
                ? "cursor-not-allowed bg-purple-500/30 text-purple-400/50"
                : "bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] hover:bg-purple-400"
            )}
          >
            {loading ? "Submitting…" : "Submit Proof"}
          </motion.button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function CommunityQuestCard({
  quest,
  address,
  onSubmitSuccess,
}: {
  quest: ArenaQuest;
  address: string;
  onSubmitSuccess: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const sub = quest.communitySubmission;
  const isRejected = sub?.status === "REJECTED";
  const isPending = sub?.status === "PENDING";
  const isApproved = sub?.status === "APPROVED";
  const hasSubmission = !!sub && !isRejected;

  if (hasSubmission) {
    // Submitted (pending or approved)
    return (
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="relative flex flex-col gap-10 overflow-hidden rounded-8 border-1/2 border-purple-500/30 bg-slate-800 p-14 transition-colors"
      >
        {/* Status badge */}
        {isPending && (
          <div className="flex items-center gap-6 rounded-6 bg-yellow-500/10 px-10 py-6 text-caption font-semibold text-yellow-400">
            <span className="inline-block h-[6px] w-[6px] animate-pulse rounded-full bg-yellow-400" />
            Under Review
          </div>
        )}
        {isApproved && (
          <div className="flex items-center gap-6 rounded-6 bg-green-500/10 px-10 py-6 text-caption font-semibold text-green-400">
            Approved ✓
          </div>
        )}

        <div className="flex items-start gap-8">
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-purple-500/15 px-8 py-2 text-caption uppercase text-purple-400">
              Community
            </span>
            <h4 className="mt-8 truncate text-body-large font-bold text-white">{quest.title}</h4>
            {quest.target?.communityPrompt && (
              <p className="mt-4 text-body-small italic leading-snug text-slate-100 opacity-60">
                {quest.target.communityPrompt}
              </p>
            )}
          </div>
          {sub?.imageUrl && (
            <img
              src={sub.imageUrl}
              alt="submission"
              className="h-14 w-14 shrink-0 rounded-4 object-cover opacity-80"
              style={{ width: 56, height: 56 }}
            />
          )}
        </div>

        {sub?.caption && (
          <p className="text-caption italic text-slate-400">"{sub.caption}"</p>
        )}

        <div className="flex flex-wrap gap-6 text-caption">
          <Reward icon="✦" value={`${quest.reward.xp} XP`} />
          {!!quest.reward.raffleTickets && <Reward icon="🎟" value={`${quest.reward.raffleTickets}`} />}
        </div>

        <div className="flex items-center gap-6 text-caption text-slate-500">
          <CameraIcon />
          <span>Photo submitted</span>
        </div>
      </motion.div>
    );
  }

  // Not submitted or rejected — show submit card
  return (
    <>
      <motion.div
        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        className="relative flex flex-col gap-10 overflow-hidden rounded-8 border-1/2 border-slate-600 bg-slate-800 p-14 transition-colors hover:border-purple-500/40"
      >
        {/* Rejected banner */}
        {isRejected && (
          <div className="rounded-6 bg-red-500/10 px-10 py-6 text-caption font-semibold text-red-400">
            Rejected{sub?.adminNote ? `: ${sub.adminNote}` : ""}
          </div>
        )}

        <div className="min-w-0">
          <span className="rounded-full bg-purple-500/15 px-8 py-2 text-caption uppercase text-purple-400">
            Community
          </span>
          <h4 className="mt-8 truncate text-body-large font-bold text-white">{quest.title}</h4>
          {quest.target?.communityPrompt && (
            <p className="mt-4 text-body-small italic leading-snug text-slate-100 opacity-60">
              {quest.target.communityPrompt}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-6 text-caption">
          <Reward icon="✦" value={`${quest.reward.xp} XP`} />
          {!!quest.reward.raffleTickets && <Reward icon="🎟" value={`${quest.reward.raffleTickets}`} />}
        </div>

        <div className="mt-auto flex justify-end pt-4">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-purple-500 px-14 py-6 text-caption font-semibold uppercase tracking-wide text-white shadow-[0_0_12px_rgba(168,85,247,0.35)] transition-colors hover:bg-purple-400"
          >
            {isRejected ? "Resubmit" : "Submit Proof"}
          </motion.button>
        </div>
      </motion.div>

      {modalOpen && (
        <UploadModal
          quest={quest}
          address={address}
          onClose={() => setModalOpen(false)}
          onSuccess={onSubmitSuccess}
        />
      )}
    </>
  );
}

export function CommunityQuestSection({
  quests,
  address,
  onSubmitSuccess,
}: {
  quests: ArenaQuest[];
  address: string;
  onSubmitSuccess: () => void;
}) {
  if (!quests.length) return null;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center gap-8">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-400">
          Community Quests
        </span>
        <span className="rounded-full bg-purple-500/10 px-8 py-2 text-[10px] font-bold text-purple-400">
          {quests.filter((q) => !q.communitySubmission || q.communitySubmission.status === "REJECTED").length} open
        </span>
      </div>
      <motion.div
        className="grid gap-12 md:grid-cols-2 xl:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {quests.map((q) => (
          <CommunityQuestCard
            key={q.key}
            quest={q}
            address={address}
            onSubmitSuccess={onSubmitSuccess}
          />
        ))}
      </motion.div>
    </div>
  );
}
