import { Trans } from "@lingui/macro";
import cx from "classnames";
import { ArenaUserState } from "domain/arena";

export function LetterBoard({ state }: { state: ArenaUserState | null }) {
  const word = state?.word ?? "QUEST";
  const letters = word.split("");
  const collected = new Set(state?.letters ?? []);
  const completed = state?.wordCompletedCount ?? 0;

  return (
    <div className="flex flex-col gap-16 rounded-8 border-1/2 border-slate-600 bg-slate-800 p-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h2 font-bold text-white">
            <Trans>Letter Collection</Trans>
          </h3>
          <p className="text-body-small text-slate-100 opacity-70">
            <Trans>Collect every letter to unlock +50 XP. Board resets after completion.</Trans>
          </p>
        </div>
        <div className="text-right">
          <div className="text-caption uppercase text-slate-100 opacity-60">
            <Trans>Completions</Trans>
          </div>
          <div className="text-h1 font-bold text-green-500">{completed}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-12">
        {letters.map((l, i) => {
          const has = collected.has(l);
          return (
            <div
              key={`${l}-${i}`}
              className={cx(
                "flex h-72 w-72 items-center justify-center rounded-8 border-1/2 text-h1 font-bold transition-all",
                has
                  ? "border-green-500 bg-green-500/15 text-green-500 shadow-[0_0_20px_rgba(15,222,141,0.3)]"
                  : "border-slate-600 bg-slate-700 text-slate-100 opacity-50"
              )}
            >
              {l}
            </div>
          );
        })}
      </div>

      <p className="text-caption text-slate-100 opacity-60">
        <Trans>Next word drops after {word} is completed. More words = extended engagement.</Trans>
      </p>
    </div>
  );
}
