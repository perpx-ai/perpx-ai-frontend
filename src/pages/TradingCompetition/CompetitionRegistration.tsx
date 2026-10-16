import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useAuth } from "context/AuthContext/AuthContextProvider";
import { UserContact, submitUserContact } from "lib/api/userContact";
import { helperToast } from "lib/helperToast";

import Button from "components/Button/Button";
import Modal from "components/Modal/Modal";

import { useCompetitionRegistration } from "./CompetitionRegistrationContext";
import { useCompetitionStarted } from "./useCompetitionStarted";

/** Deliberately permissive; the backend applies the same shape check. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;

const CARD_CLASS_NAME = `mt-[clamp(16px,3vw,24px)] w-full max-w-[420px] rounded-[clamp(12px,2vw,16px)]
  border border-white/10 bg-[#0C1E2C]/70 p-[clamp(14px,3vw,20px)] backdrop-blur-sm`;

const LABEL_CLASS_NAME = "text-[clamp(10px,2.2vw,11px)] font-semibold uppercase tracking-[0.16em] text-[#7a8a9a]";

const INPUT_CLASS_NAME = `mt-8 w-full rounded-8 border border-white/10 bg-[#0A1A26] px-12 py-10 text-14
  text-white placeholder:text-[#5c6b78] outline-none transition-colors
  focus:border-[#35B9C0]/60 disabled:opacity-50`;

/**
 * Registration gate for the trading competition.
 *
 * Signing up is the only thing the landing page asks of a first-time visitor;
 * the moment they are registered the landing page hands them off to the
 * countdown (or straight to the dashboard, once the competition is live), so
 * this renders nothing in that state. Registering requires a connected wallet,
 * because the saved row is keyed by the wallet address from the JWT; clicking
 * Register opens the wallet chooser only when nothing is connected yet, so an
 * already-connected visitor goes straight to the name/email form.
 */
export default function CompetitionRegistration() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { isAuthenticating, makeAuthenticatedRequest } = useAuth();
  const { isRegistered, isChecking, contact, markRegistered } = useCompetitionRegistration();
  const hasStarted = useCompetitionStarted();

  const [isFormVisible, setIsFormVisible] = useState(false);
  /** Set when Register is clicked before a wallet is connected, so the form can open once it is. */
  const [isRegistrationPending, setIsRegistrationPending] = useState(false);

  // Wallet just connected off the back of a Register click — pick the flow back up.
  useEffect(() => {
    if (isConnected && isRegistrationPending) {
      setIsRegistrationPending(false);
      setIsFormVisible(true);
    }
  }, [isConnected, isRegistrationPending]);

  const handleRegisterClick = useCallback(() => {
    if (isConnected) {
      setIsFormVisible(true);
      return;
    }

    setIsRegistrationPending(true);
    openConnectModal?.();
  }, [isConnected, openConnectModal]);

  const handleSaved = useCallback(
    (saved: UserContact) => {
      markRegistered(saved);
      setIsFormVisible(false);
    },
    [markRegistered]
  );

  // Registered — the landing page is redirecting away from here, so the gate has
  // nothing left to ask for.
  if (isRegistered) {
    return null;
  }

  return (
    <>
      <div className={CARD_CLASS_NAME}>
        <div className={LABEL_CLASS_NAME}>
          <Trans>Registration</Trans>
        </div>

        {isChecking ? (
          <p className="mt-[clamp(8px,1.8vw,12px)] text-[clamp(12px,2.4vw,14px)] leading-[1.6] text-[#8296a5]">
            <Trans>Checking your registration...</Trans>
          </p>
        ) : (
          <>
            <p className="mt-[clamp(8px,1.8vw,12px)] text-[clamp(12px,2.4vw,14px)] leading-[1.6] text-[#8296a5]">
              {isConnected ? (
                hasStarted ? (
                  <Trans>Register with your name and email to join the live leaderboard.</Trans>
                ) : (
                  <Trans>Register with your name and email to unlock the countdown.</Trans>
                )
              ) : hasStarted ? (
                <Trans>Connect your wallet to register and join the live leaderboard.</Trans>
              ) : (
                <Trans>Connect your wallet to register and unlock the countdown.</Trans>
              )}
            </p>

            <Button
              variant="primary-action"
              className="mt-[clamp(12px,2.4vw,16px)] w-full"
              onClick={handleRegisterClick}
            >
              {isConnected ? <Trans>Register Now</Trans> : <Trans>Connect Wallet to Register</Trans>}
            </Button>
          </>
        )}
      </div>

      <RegistrationModal
        isVisible={isFormVisible}
        setIsVisible={setIsFormVisible}
        contact={contact}
        isAuthenticating={isAuthenticating}
        makeAuthenticatedRequest={makeAuthenticatedRequest}
        onSaved={handleSaved}
      />
    </>
  );
}

function RegistrationModal({
  isVisible,
  setIsVisible,
  contact,
  isAuthenticating,
  makeAuthenticatedRequest,
  onSaved,
}: {
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
  contact: UserContact | null;
  isAuthenticating: boolean;
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response | undefined>;
  onSaved: (contact: UserContact) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset to the saved details every time the form opens, so a cancelled edit
  // does not leak into the next one.
  useEffect(() => {
    if (isVisible) {
      setName(contact?.name ?? "");
      setEmail(contact?.email ?? "");
      setError(null);
    }
  }, [isVisible, contact]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      if (!trimmedName) {
        setError(t`Please enter your name.`);
        return;
      }
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError(t`Please enter a valid email address.`);
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        const saved = await submitUserContact(makeAuthenticatedRequest, {
          name: trimmedName,
          email: trimmedEmail,
        });
        helperToast.success(t`You are registered for the trading competition.`);
        onSaved(saved);
      } catch (submitError: any) {
        setError(submitError?.message || t`Registration failed. Please try again.`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, email, makeAuthenticatedRequest, onSaved]
  );

  const isBusy = isSubmitting || isAuthenticating;

  return (
    <Modal isVisible={isVisible} setIsVisible={setIsVisible} label={t`Competition Registration`}>
      <form className="w-full sm:w-[360px]" onSubmit={handleSubmit}>
        <label className="block">
          <span className={LABEL_CLASS_NAME}>
            <Trans>Name</Trans>
          </span>
          <input
            className={INPUT_CLASS_NAME}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t`satoshi`}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="name"
            disabled={isBusy}
          />
        </label>

        <label className="mt-16 block">
          <span className={LABEL_CLASS_NAME}>
            <Trans>Email</Trans>
          </span>
          <input
            className={INPUT_CLASS_NAME}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t`sat@example.com`}
            maxLength={EMAIL_MAX_LENGTH}
            autoComplete="email"
            disabled={isBusy}
          />
        </label>

        {isAuthenticating && (
          <p className="mt-12 text-12 text-[#8296a5]">
            <Trans>Confirm the signature request in your wallet to verify ownership.</Trans>
          </p>
        )}

        {error && <p className="mt-12 text-12 text-red-400">{error}</p>}

        <Button variant="primary-action" type="submit" className="mt-20 w-full" disabled={isBusy}>
          {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Submit</Trans>}
        </Button>
      </form>
    </Modal>
  );
}
