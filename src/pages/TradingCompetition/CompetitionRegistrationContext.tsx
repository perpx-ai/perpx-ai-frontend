import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { useAuth } from "context/AuthContext/AuthContextProvider";
import { UserContact, checkUserContactRegistration, fetchMyUserContact } from "lib/api/userContact";

type CompetitionRegistrationValue = {
  /** True once this wallet is known to have registered. */
  isRegistered: boolean;
  /** The lookup is still in flight — the answer is not known yet, so do not redirect. */
  isChecking: boolean;
  /** Saved name and email, once an authenticated lookup has landed. Null otherwise. */
  contact: UserContact | null;
  /** Called after a successful submit, so the section reacts without a refetch. */
  markRegistered: (contact: UserContact) => void;
};

const CompetitionRegistrationContext = createContext<CompetitionRegistrationValue | null>(null);

/**
 * Owns the answer to "has this wallet registered?" for the whole competition
 * section.
 *
 * It lives above the routes because that one fact decides which of the three a
 * visitor sees: unregistered stays on the landing page, registered goes to the
 * countdown, and once the competition starts, to the dashboard. Keeping it here
 * means the lookup runs once per wallet instead of once per page, and moving
 * between the pages never re-flashes the gate.
 *
 * The gate itself opens off the public `check/:address` lookup, which answers as
 * soon as the wallet connects. A returning visitor therefore gets through
 * without signing anything; the signature is only needed to submit or edit the
 * details, and the authenticated lookup that carries name and email runs
 * alongside, whenever a session happens to exist.
 */
export function CompetitionRegistrationProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { isAuthenticated, makeAuthenticatedRequest } = useAuth();

  const [contact, setContact] = useState<UserContact | null>(null);
  /** Answer from the public lookup: null while unknown, for this wallet only. */
  const [isAddressRegistered, setIsAddressRegistered] = useState<boolean | null>(null);

  // The gate: ask the public endpoint whether this wallet already registered.
  useEffect(() => {
    if (!address) {
      setIsAddressRegistered(null);
      return;
    }

    let isStale = false;
    setIsAddressRegistered(null);

    checkUserContactRegistration(address)
      .then((isRegistered) => {
        if (!isStale) {
          setIsAddressRegistered(isRegistered);
        }
      })
      .catch(() => {
        // Treat an unreachable check as "not registered": that shows the form,
        // which is recoverable, rather than locking the competition behind a
        // failed request.
        if (!isStale) {
          setIsAddressRegistered(false);
        }
      });

    return () => {
      isStale = true;
    };
  }, [address]);

  // Load any existing registration so a returning visitor sees their details
  // instead of an empty form. Needs a session, so it only runs once one exists —
  // the gate above does not wait for it.
  useEffect(() => {
    if (!isAuthenticated) {
      setContact(null);
      return;
    }

    let isStale = false;

    fetchMyUserContact(makeAuthenticatedRequest)
      .then((saved) => {
        if (!isStale) {
          setContact(saved);
        }
      })
      .catch(() => {
        // A failed lookup only means we cannot pre-fill; registering still works.
      });

    return () => {
      isStale = true;
    };
  }, [isAuthenticated, makeAuthenticatedRequest]);

  const markRegistered = useCallback((saved: UserContact) => {
    setContact(saved);
    setIsAddressRegistered(true);
  }, []);

  const value = useMemo<CompetitionRegistrationValue>(
    () => ({
      isRegistered: isAddressRegistered === true || Boolean(contact),
      // A wallet still reconnecting counts as checking: on a reload it takes a
      // moment for wagmi to restore the connection, and treating that gap as
      // "not registered" would bounce a registered visitor off the page they
      // reloaded before the lookup ever ran.
      isChecking: isConnecting || isReconnecting || (isConnected && isAddressRegistered === null),
      contact,
      markRegistered,
    }),
    [isAddressRegistered, contact, isConnected, isConnecting, isReconnecting, markRegistered]
  );

  return <CompetitionRegistrationContext.Provider value={value}>{children}</CompetitionRegistrationContext.Provider>;
}

export function useCompetitionRegistration(): CompetitionRegistrationValue {
  const value = useContext(CompetitionRegistrationContext);

  if (!value) {
    throw new Error("useCompetitionRegistration must be used inside CompetitionRegistrationProvider");
  }

  return value;
}
