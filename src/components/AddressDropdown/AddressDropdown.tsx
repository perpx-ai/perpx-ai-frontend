import { useEffect, useMemo } from "react";

import { isSettlementChain, MULTICHAIN_TOKEN_MAPPING } from "config/multichain";
import { useChainId } from "lib/chains";
import { EMPTY_OBJECT } from "lib/objects";
import { useIsNonEoaAccountOnAnyChain } from "lib/wallets/useAccountType";
import type { SettlementChainId } from "sdk/configs/chains";

import { AddressDropdownWithMultichain } from "./AddressDropdownWithMultichain";
import { AddressDropdownWithoutMultichain } from "./AddressDropdownWithoutMultichain";
import { useLocation } from "react-router-dom";
import { getCustodyWallet } from "lib/api";
import { useAuth } from "context/AuthContext/AuthContextProvider";
import { BACKEND_URL } from "config/perpx";

type Props = {
  account: string;
};

export function AddressDropdown({ account }: Props) {
  const { chainId } = useChainId();
  const { isAuthenticated } = useAuth();

  const isNonEoaAccountOnAnyChain = useIsNonEoaAccountOnAnyChain();

  const hasRelatedSourceChains = useMemo(
    () =>
      Object.values(MULTICHAIN_TOKEN_MAPPING[chainId as SettlementChainId] || EMPTY_OBJECT).some(
        (sourceChainMapping) => Object.keys(sourceChainMapping).length > 0
      ),
    [chainId]
  );
  const location = useLocation();
  const abc = new URLSearchParams(location?.search ?? "").get("referrals") ||
    location?.hash?.split("#referrals=")[1];

  useEffect(() => {
    if (account && isAuthenticated) {
      const url = new URL(`${BACKEND_URL}/api/admin/user`);
      url.searchParams.set("address", account);

      if (abc) {
        url.searchParams.set("reffral", abc);
        console.log("🔗 Registering user with referral:", abc);
      }

      fetch(url.toString(), {
        method: "GET",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status) {
            console.log("✅ User registered successfully", data);
            if (abc) {
              console.log("✅ Referral code applied:", abc);
            }
          } else {
            console.warn("⚠️ User registration response:", data.message);
          }
        })
        .catch((error) => {
          console.error("❌ User registration failed:", error);
        });

      getCustodyWallet(account).then((data) => {
        if (data?.custodyWalletAddress) {
          localStorage.setItem("custodyWallet", data.custodyWalletAddress);
          localStorage.setItem("userAddress", data.userAddress);
        } else {
          localStorage.removeItem("custodyWallet");
          localStorage.removeItem("userAddress");
        }
      }).catch(() => {
        localStorage.removeItem("custodyWallet");
        localStorage.removeItem("userAddress");
      });
    }
  }, [account, abc, isAuthenticated]);
  if (!isSettlementChain(chainId) || !hasRelatedSourceChains || isNonEoaAccountOnAnyChain) {
    return <AddressDropdownWithoutMultichain account={account} />;
  }

  return <AddressDropdownWithMultichain account={account} />;
}
