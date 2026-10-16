export function prettifyArenaError(raw: unknown): string {
  const msg = (raw as any)?.message || String(raw || "");
  const cleaned = msg.replace(/^.*?:\s*/, "").trim();

  const cooldown = cleaned.match(/cooldown for (\d+)s/i);
  if (cooldown) {
    const seconds = parseInt(cooldown[1], 10);
    return `Already claimed — come back in ${formatDuration(seconds)}.`;
  }

  if (/already completed.*social join/i.test(cleaned) || /only be claimed once/i.test(cleaned)) {
    return "You've already completed this — social join quests are one-time only.";
  }
  if (/no active stake/i.test(cleaned)) {
    return "No active stake found. Stake on PerpX first to claim this quest.";
  }
  if (/please connect your telegram/i.test(cleaned)) {
    return "Please connect your Telegram account by clicking the Join button first.";
  }
  if (/please connect your twitter/i.test(cleaned)) {
    return "Please connect your X account by clicking Connect X first.";
  }
  if (/please enter your (twitter|telegram)/i.test(cleaned)) {
    return cleaned;
  }
  if (/verification failed/i.test(cleaned)) {
    return "We couldn’t verify that action. Double-check your ID and try again.";
  }
  if (/quest not found/i.test(cleaned)) {
    return "This quest isn’t available right now.";
  }
  if (/raffle.*disabled/i.test(cleaned)) {
    return "The raffle wheel is currently turned off. Check back later.";
  }
  if (/no raffle tickets/i.test(cleaned)) {
    return "No raffle tickets yet — finish a quest to earn one.";
  }
  if (/network|fetch|failed/i.test(cleaned)) {
    return "Network hiccup — please try again.";
  }
  return cleaned || "Something went wrong.";
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
