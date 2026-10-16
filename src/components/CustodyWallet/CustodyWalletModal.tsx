import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWalletClient
} from "wagmi";
import { arbitrum } from "wagmi/chains";

import Modal from "components/Modal/Modal";
import TokenSelector from "components/TokenSelector/TokenSelector";
import { withdrawETH, withdrawToken } from "lib/api/contractExecutor";
import { getHlBalances, getWithdrawalStatus, withdrawFromHl, recordDeposit } from "lib/api/hyperliquid";
import { helperToast } from "lib/helperToast";
import { useAuth } from "context/AuthContext/AuthContextProvider";
import { getStoredAuthToken } from "lib/api/authSession";

import { TOKENS } from "sdk/configs/tokens";
import "./CustodyWalletModal.scss";

type WithdrawSource = "custody" | "hyperliquid";

type TabType = 'deposit' | 'withdraw';

const ARBITRUM_CHAIN_ID = 42161;
const GAS_RESERVE_USD = 2.5; // $2.5 gas reserve requirement

const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

type Props = {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  custodyWalletAddress: string;
};

export function CustodyWalletModal({
  isVisible,
  setIsVisible,
  custodyWalletAddress
}: Props) {
  const { address: account, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { token: authToken, ensureAuthenticated } = useAuth();

  // Note: useTokensData requires SyntheticsStateContextProvider
  // Since CustodyWallet can be used outside that context (e.g., in header),
  // we'll pass undefined and handle balances differently
  const tokensData = undefined;

  // Get Arbitrum tokens
  const arbitrumTokens = TOKENS[ARBITRUM_CHAIN_ID] || [];

  const [activeTab, setActiveTab] = useState<TabType>('deposit');
  const [withdrawSource, setWithdrawSource] = useState<WithdrawSource>("custody");
  const [selectedToken, setSelectedToken] = useState(arbitrumTokens[0] || null);
  const [amount, setAmount] = useState("");
  const [maxBalance, setMaxBalance] = useState("0.00");
  const [hlUsdcBalance, setHlUsdcBalance] = useState<string | null>(null);
  const [isLoadingHlBalance, setIsLoadingHlBalance] = useState(false);
  const [isConfirmingWithdrawal, setIsConfirmingWithdrawal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [ethBalance, setEthBalance] = useState("0");
  const [ethPriceUSD, setEthPriceUSD] = useState(0);
  const [hasInsufficientGas, setHasInsufficientGas] = useState(false);
  const [showLowGasWarning, setShowLowGasWarning] = useState(false);

  const isUserRejectedError = useCallback((error: any) => {
    const text = `${error?.shortMessage || ""} ${error?.message || ""}`.toLowerCase();
    return text.includes("user denied") || text.includes("user rejected");
  }, []);

  // Function to copy address to clipboard
  const copyAddressToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedAddress(null), 2000);
      helperToast.success("Address copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy address:", error);
      helperToast.error("Failed to copy address");
    }
  };

  // Fetch ETH price from CoinGecko
  // Note: ETH on Arbitrum has the same price as ETH on mainnet
  const fetchETHPrice = useCallback(async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      const data = await response.json();
      const price = data?.ethereum?.usd || 0;
      setEthPriceUSD(price);
      return price;
    } catch (error) {
      console.error("Error fetching ETH price:", error);
      // Fallback price if API fails
      setEthPriceUSD(3000);
      return 3000;
    }
  }, []);

  // Fetch ETH balance and check gas reserve
  const fetchETHBalance = useCallback(async () => {
    if (!publicClient || !account || wrongNetwork) {
      setEthBalance("0");
      setShowLowGasWarning(false);
      return;
    }

    try {
      const balance = await publicClient.getBalance({ address: account });
      const formatted = formatUnits(balance, 18);
      setEthBalance(formatted);
      return formatted;
    } catch (error) {
      console.error("Error fetching ETH balance:", error);
      setEthBalance("0");
      setShowLowGasWarning(false);
      return "0";
    }
  }, [account, publicClient, wrongNetwork]);

  // Check if user has sufficient gas
  const checkGasReserve = useCallback(async () => {
    if (!account || wrongNetwork) {
      setHasInsufficientGas(false);
      setShowLowGasWarning(false);
      return true;
    }

    const ethBal = await fetchETHBalance();
    const price = await fetchETHPrice();

    if (!ethBal || !price) {
      setHasInsufficientGas(false);
      setShowLowGasWarning(false);
      return true;
    }

    const ethBalanceNum = parseFloat(ethBal);
    const ethValueUSD = ethBalanceNum * price;

    // First check: If ETH balance in USD is less than gas reserve, show warning immediately
    if (ethValueUSD < GAS_RESERVE_USD) {
      setShowLowGasWarning(true);
      setHasInsufficientGas(true);
      return false;
    }

    // Second check: If depositing native ETH, check if balance minus deposit amount is >= gas reserve
    if (activeTab === 'deposit' && selectedToken?.isNative && amount) {
      const depositAmount = parseFloat(amount || "0");
      const remainingETH = ethBalanceNum - depositAmount;
      const remainingUSD = remainingETH * price;

      if (remainingUSD < GAS_RESERVE_USD) {
        setHasInsufficientGas(true);
        setShowLowGasWarning(false); // Don't show top warning, just disable button
        return false;
      }
    }

    setHasInsufficientGas(false);
    setShowLowGasWarning(false);
    return true;
  }, [activeTab, account, wrongNetwork, selectedToken, amount, fetchETHBalance, fetchETHPrice]);

  useEffect(() => {
    console.log("Connected chain:", chainId);
    setWrongNetwork(chainId !== ARBITRUM_CHAIN_ID);
  }, [chainId]);

  // Check gas reserve when modal opens
  useEffect(() => {
    if (isVisible && account && !wrongNetwork) {
      checkGasReserve();
    }
  }, [isVisible, account, wrongNetwork, checkGasReserve]);

  // Also check when amount or token changes
  useEffect(() => {
    if (isVisible && account && amount && selectedToken && !wrongNetwork) {
      checkGasReserve();
    }
  }, [amount, selectedToken]);

  const fetchBalance = useCallback(async () => {
    if (!publicClient || wrongNetwork || !selectedToken) {
      setMaxBalance("0.00");
      return;
    }

    // Determine which address to check based on active tab
    const addressToCheck = activeTab === 'deposit'
      ? account
      : custodyWalletAddress as `0x${string}`;

    if (!addressToCheck) {
      setMaxBalance("0.00");
      return;
    }

    try {
      setIsLoadingBalance(true);

      let balance;

      if (selectedToken.isNative) {
        balance = await publicClient.getBalance({ address: addressToCheck });
      } else {
        balance = await publicClient.readContract({
          address: selectedToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [addressToCheck]
        });
      }

      const formatted = formatUnits(balance, selectedToken.decimals);
      setMaxBalance(parseFloat(formatted).toFixed(6));
    } catch (error) {
      console.error("Error fetching balance:", error);
      setMaxBalance("0.00");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [account, publicClient, wrongNetwork, selectedToken, activeTab, custodyWalletAddress]);

  useEffect(() => {
    if (isVisible && account && !wrongNetwork && selectedToken) {
      fetchBalance();
    }
  }, [isVisible, account, wrongNetwork, selectedToken, fetchBalance]);

  useEffect(() => {
    setAmount("");
    if (selectedToken && !wrongNetwork) {
      fetchBalance();
    }
  }, [selectedToken, activeTab]);

  const handleMaxClick = async () => {
    if (wrongNetwork) return;
    setAmount(maxBalance);
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: ARBITRUM_CHAIN_ID });
      helperToast.success("Switched to Arbitrum Network");
    } catch (e) {
      console.error(e);
      helperToast.error("Failed to switch network");
    }
  };

  const handleTokenChange = (token: any) => {
    setSelectedToken(token);
  };

  // Fetch HL USDC balance when withdraw source switches to "hyperliquid"
  useEffect(() => {
    if (activeTab !== "withdraw" || withdrawSource !== "hyperliquid" || !custodyWalletAddress) {
      setHlUsdcBalance(null);
      return;
    }
    setIsLoadingHlBalance(true);
    getHlBalances(custodyWalletAddress)
      .then((bals: any[]) => {
        const usdc = bals.find((b) => b.asset === "USDC" || b.asset === "usdc");
        setHlUsdcBalance(parseFloat(usdc?.free ?? "0").toFixed(2));
      })
      .catch(() => setHlUsdcBalance("0"))
      .finally(() => setIsLoadingHlBalance(false));
  }, [activeTab, withdrawSource, custodyWalletAddress]);

  const refreshHlBalance = useCallback(async (): Promise<string | null> => {
    if (!custodyWalletAddress) return null;
    try {
      const bals: any[] = await getHlBalances(custodyWalletAddress);
      const usdc = bals.find((b) => b.asset === "USDC" || b.asset === "usdc");
      const next = parseFloat(usdc?.free ?? "0").toFixed(2);
      setHlUsdcBalance(next);
      return next;
    } catch (err) {
      return null;
    }
  }, [custodyWalletAddress]);

  // The submit call returns as soon as the withdrawal is recorded; the transfer
  // out of Hyperliquid happens afterwards on the server. So at submit time we
  // genuinely do not yet know whether it worked, and must not claim we do.
  // Poll the real status and report that instead.
  //
  // Deliberately does NOT hold isLoadingHlBalance: that flag replaces the
  // balance with "Loading..." and blanks the MAX button, so holding it across
  // the whole poll left the modal looking hung.
  const pollWithdrawalProgress = useCallback(
    async (withdrawalId: string | undefined, sessionToken: string, submittedAmount: string) => {
      const balanceBefore = hlUsdcBalance;
      const deadline = Date.now() + 120_000;

      setIsConfirmingWithdrawal(true);
      try {
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 3_000));

          const status = withdrawalId
            ? await getWithdrawalStatus(withdrawalId, sessionToken).catch(() => null)
            : null;

          if (status) {
            if (status.step1Status === "FAILED" || status.status === "FAILED") {
              await refreshHlBalance();
              helperToast.error(
                status.errorMessage
                  ? `Withdrawal failed: ${status.errorMessage}`
                  : "Withdrawal failed — your funds were not moved. Check Activity before retrying.",
              );
              return;
            }

            // step1Status is the meaningful signal here: it means the funds have
            // actually left Hyperliquid. Overall status only flips to SUCCESS
            // after step 2 lands, which is ~15 min away.
            if (status.step1Status === "SUCCESS") {
              await refreshHlBalance();
              helperToast.success(
                `${submittedAmount} USDC is on its way to your connected wallet. Arrives in ~15 minutes — track it in Activity.`,
              );
              return;
            }
          } else {
            // No status available (older backend, or the id was not returned):
            // fall back to watching the balance for movement.
            const next = await refreshHlBalance();
            if (next !== null && balanceBefore !== null && next !== balanceBefore) return;
          }
        }

        helperToast.info(
          "Your withdrawal is still processing. Track its status in Activity.",
        );
      } finally {
        setIsConfirmingWithdrawal(false);
        void refreshHlBalance();
      }
    },
    [hlUsdcBalance, refreshHlBalance],
  );

  const handleHlWithdraw = useCallback(async () => {
    // Re-establish a lapsed session (idle wallet auto-lock, expired sign-in prompt)
    // rather than turning the user away with a login error.
    const sessionToken = authToken ?? (await ensureAuthenticated().catch(() => null));
    if (!sessionToken) {
      helperToast.error("Sign in with your wallet to continue");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      helperToast.error("Invalid amount");
      return;
    }
    if (parseFloat(amount) < 1) {
      helperToast.error("Minimum withdrawal from Hyperliquid is 1 USDC");
      return;
    }
    if (hlUsdcBalance !== null && parseFloat(amount) > parseFloat(hlUsdcBalance)) {
      helperToast.error("Insufficient HL balance");
      return;
    }
    if (!account) {
      helperToast.error("Connect your wallet");
      return;
    }
    try {
      setIsLoading(true);
      // One-action withdrawal: HL → custody → connected wallet
      // Pass connected wallet as destination; backend handles both steps
      const submitted = await withdrawFromHl(amount, sessionToken, account);

      // Not "success" — the server has only recorded the withdrawal at this
      // point. pollWithdrawalProgress below reports the actual outcome.
      const submittedAmount = amount;
      helperToast.info(`Withdrawal of ${submittedAmount} USDC submitted. Confirming...`);
      setAmount("");

      // The server records the withdrawal and returns straight away — the
      // Hyperliquid transfer happens afterwards. So a single balance refetch
      // here would race it and always show the pre-withdrawal figure, which
      // reads as "nothing happened". Poll instead: refresh the balance until it
      // moves, and report a background failure rather than leaving the success
      // toast as the last word.
      void pollWithdrawalProgress(submitted?.withdrawalId, sessionToken, submittedAmount);

      // Close like the deposit/GMX paths do. The poll above keeps running after
      // unmount and reports the outcome through toasts, so there is nothing
      // left in here for the user to watch.
      setTimeout(() => setIsVisible(false), 1500);
    } catch (e: any) {
      helperToast.error(e.message ?? "HL withdrawal failed");
    } finally {
      setIsLoading(false);
    }
  }, [account, authToken, ensureAuthenticated, amount, hlUsdcBalance, pollWithdrawalProgress, setIsVisible]);

  const handleDeposit = useCallback(async () => {
    if (!account || !walletClient || !publicClient) {
      helperToast.error("Connect your wallet");
      return;
    }

    if (wrongNetwork) {
      helperToast.error("Switch to Arbitrum first");
      return;
    }

    if (!selectedToken) {
      helperToast.error("Please select a token");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      helperToast.error("Invalid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(maxBalance)) {
      helperToast.error("Insufficient balance");
      return;
    }

    try {
      setIsLoading(true);

      const amountInWei = parseUnits(amount, selectedToken.decimals);
      let hash;

      if (selectedToken.isNative) {
        const estimate = await publicClient.estimateGas({
          account: account as `0x${string}`,
          to: custodyWalletAddress as `0x${string}`,
          value: amountInWei,
        });

        hash = await walletClient.sendTransaction({
          to: custodyWalletAddress as `0x${string}`,
          value: amountInWei,
          chain: arbitrum,
          gas: estimate,
        });
      } else {
        hash = await walletClient.writeContract({
          address: selectedToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [custodyWalletAddress as `0x${string}`, amountInWei],
          chain: arbitrum
        });
      }

      helperToast.info(`Deposit of ${amount} ${selectedToken.symbol} submitted. Confirming...`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        helperToast.success(`Successfully deposited ${amount} ${selectedToken.symbol} to your PerpX Wallet. Tx: ${hash.slice(0, 10)}...`);

        // Record deposit in backend for Activity tracking
        const activityToken = authToken ?? getStoredAuthToken();
        if (activityToken) {
          try {
            await recordDeposit(activityToken, {
              amount,
              asset: selectedToken.symbol,
              txHash: hash,
              custodyAddress: custodyWalletAddress,
            });
          } catch (err) {
            console.error("Failed to record deposit activity:", err);
          }
        }

        setAmount("");
        await fetchBalance();
        await fetchETHBalance();

        setTimeout(() => setIsVisible(false), 1500);
      } else {
        helperToast.error(`Deposit of ${amount} ${selectedToken.symbol} failed. The transaction was reverted on-chain.`);
      }
    } catch (e: any) {
      console.error("Deposit error:", e);
      if (isUserRejectedError(e)) {
        helperToast.error(`Deposit cancelled. You rejected the transaction in your wallet.`);
      } else if (`${e?.shortMessage || ""} ${e?.message || ""}`.toLowerCase().includes("intrinsic gas too low")) {
        helperToast.error(`Deposit failed: Gas limit too low. Please retry with sufficient gas.`);
      } else {
        helperToast.error(e?.shortMessage || e?.message || "Deposit failed");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    account,
    walletClient,
    publicClient,
    amount,
    maxBalance,
    custodyWalletAddress,
    fetchBalance,
    fetchETHBalance,
    wrongNetwork,
    selectedToken,
    checkGasReserve,
    isUserRejectedError
  ]);

  const handleWithdraw = useCallback(async () => {
    if (!account) {
      helperToast.error("Connect your wallet");
      return;
    }

    if (wrongNetwork) {
      helperToast.error("Switch to Arbitrum first");
      return;
    }

    if (!selectedToken) {
      helperToast.error("Please select a token");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      helperToast.error("Invalid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(maxBalance)) {
      helperToast.error("Insufficient balance in custody wallet");
      return;
    }

    try {
      setIsLoading(true);

      const amountInWei = parseUnits(amount, selectedToken.decimals).toString();

      let result;
      if (selectedToken.isNative) {
        result = await withdrawETH(account, amountInWei);
      } else {
        result = await withdrawToken(account, selectedToken.address, amountInWei);
      }

      const txHash: string | undefined =
        result?.data?.transactionHash || result?.transactionHash || result?.hash;

      // The server now responds as soon as the transfer is broadcast, so wait
      // for the receipt here instead of holding the HTTP request open across
      // on-chain confirmation (which nginx was killing with a 504).
      let confirmed = false;
      if (txHash && publicClient) {
        helperToast.info(`Withdrawal of ${amount} ${selectedToken.symbol} submitted. Confirming...`);
        try {
          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash as `0x${string}`,
          });
          if (receipt.status !== "success") {
            helperToast.error(
              `Withdrawal of ${amount} ${selectedToken.symbol} was reverted on-chain. Tx: ${txHash.slice(0, 10)}...`,
            );
            return;
          }
          confirmed = true;
        } catch (waitErr) {
          // The transfer is broadcast and may well still land — don't claim it
          // failed, and don't claim it succeeded either.
          console.error("Failed to confirm withdrawal receipt:", waitErr);
          helperToast.info(
            `Withdrawal of ${amount} ${selectedToken.symbol} was submitted but could not be confirmed here. Tx: ${txHash.slice(0, 10)}...`,
          );
        }
      }

      if (confirmed) {
        helperToast.success(`Successfully withdrawn ${amount} ${selectedToken.symbol} to your connected wallet.`);
      }

      // Record withdrawal in backend for Activity tracking
      const activityToken = authToken ?? getStoredAuthToken();
      if (activityToken) {
        try {
          await recordDeposit(activityToken, {
            amount,
            asset: selectedToken.symbol,
            txHash: txHash || "unknown",
            custodyAddress: custodyWalletAddress,
            type: "withdrawal",
            destinationAddress: account as string,
          });
        } catch (err) {
          console.error("Failed to record withdrawal activity:", err);
        }
      }

      setAmount("");
      await fetchBalance();

      if (confirmed) {
        setTimeout(() => setIsVisible(false), 1500);
      }
    } catch (e: any) {
      console.error("Withdraw error:", e);
      helperToast.error(`Withdrawal of ${amount} ${selectedToken?.symbol || ''} failed: ${e?.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    account,
    amount,
    authToken,
    custodyWalletAddress,
    maxBalance,
    fetchBalance,
    publicClient,
    wrongNetwork,
    selectedToken,
    setIsVisible
  ]);

  return (
    <Modal
      className="custody-wallet-modal"
      isVisible={isVisible}
      setIsVisible={setIsVisible}
      label={activeTab === 'deposit' ? "Deposit to PerpX Wallet" : "Withdraw from PerpX Wallet"}
    >
      <div className="custody-wallet-content">
        {/* Tab buttons */}
        <div className="custody-wallet-tabs">
          <button
            className={`custody-wallet-tab ${activeTab === 'deposit' ? 'active' : ''}`}
            onClick={() => { setActiveTab('deposit'); setWithdrawSource('custody'); setAmount(''); }}
            disabled={isLoading}
            style={activeTab === 'deposit' ? { backgroundColor: '#10b981', color: '#fff' } : {}}
          >
            Deposit
          </button>
          <button
            className={`custody-wallet-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => { setActiveTab('withdraw'); setAmount(''); }}
            disabled={isLoading}
            style={activeTab === 'withdraw' ? { backgroundColor: '#f87171', color: '#fff' } : {}}
          >
            Withdraw
          </button>
        </div>

        {/* Instruction message */}
        {activeTab === 'deposit' && (
          <div className="deposit-instruction">
            <div className="deposit-instruction-icon">↗</div>
            <div className="deposit-instruction-text">
              <div className="deposit-instruction-title">Fund Your PerpX Wallet</div>
              <div className="deposit-instruction-subtitle">
                Add funds to start trading — your PerpX Wallet holds them and places your trades.
              </div>
            </div>
          </div>
        )}
        {activeTab === 'withdraw' && (
          <div className="deposit-instruction">
            <div className="deposit-instruction-icon">↙</div>
            <div className="deposit-instruction-text">
              <div className="deposit-instruction-title">Withdraw Your Funds</div>
              <div className="deposit-instruction-subtitle">
                Move funds from your PerpX Wallet back to your connected wallet
              </div>
            </div>
          </div>
        )}

        {wrongNetwork && (
          <div className="network-warning">
            <span className="network-warning-text">
              Wrong Network. Please switch to Arbitrum.
            </span>
            <button className="network-switch-button" onClick={handleSwitchNetwork}>
              Switch to Arbitrum
            </button>
          </div>
        )}


        {/* Source selector — only shown on Withdraw tab */}
        {activeTab === 'withdraw' && (
          <div className="deposit-field">
            <label className="deposit-label">Venue</label>
            <div className="deposit-amount-container" style={{ display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
              {(["custody", "hyperliquid"] as WithdrawSource[]).map((src) => (
                <button
                  key={src}
                  onClick={() => { setWithdrawSource(src); setAmount(""); }}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    background: withdrawSource === src
                      ? (src === "custody" ? "#3b82f6" : "#10b981")
                      : "transparent",
                    color: withdrawSource === src ? "#fff" : "#94a3b8",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: 13,
                  }}
                >
                  {src === "custody" ? "GMX" : "Hyperliquid"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Asset — locked to USDC when HL source */}
        <div className="deposit-field">
          <label className="deposit-label">Asset</label>
          {activeTab === 'withdraw' && withdrawSource === 'hyperliquid' ? (
            <div className="deposit-amount-container" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>USDC</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>USDC only</span>
            </div>
          ) : selectedToken ? (
            <div className="deposit-amount-container deposit-asset-row">
              <div className="deposit-asset-display">
                <TokenSelector
                  chainId={ARBITRUM_CHAIN_ID}
                  tokenAddress={selectedToken.address}
                  tokens={arbitrumTokens}
                  infoTokens={tokensData}
                  onSelectToken={handleTokenChange}
                  showSymbolImage={true}
                  showTokenImgInDropdown={true}
                  showBalances={true}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="deposit-field">
          <label className="deposit-label">Network</label>
          <div className="deposit-amount-container deposit-network-disabled">
            <span>Arbitrum</span>
          </div>
        </div>

        <div className="deposit-field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="deposit-label">Amount</label>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {activeTab === 'withdraw' && withdrawSource === 'hyperliquid'
                ? isLoadingHlBalance && hlUsdcBalance === null
                  ? "Loading..."
                  : `Balance: ${hlUsdcBalance ?? "0"} USDC${isConfirmingWithdrawal ? " · confirming..." : ""}`
                : isLoadingBalance ? "Loading..." : `Balance: ${parseFloat(maxBalance || '0') < 0.01 ? parseFloat(maxBalance || '0').toFixed(6).replace(/0+$/, '').replace(/\.$/, '') : parseFloat(maxBalance || '0').toFixed(2)} ${selectedToken?.symbol || ''}`
              }
            </span>
          </div>
          <div className="deposit-amount-container">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onKeyDown={(e) => {
                // Block alphabets and invalid characters, only allow digits, dot, backspace, delete, arrows, tab
                const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
                if (allowedKeys.includes(e.key)) return;
                if (e.key === '.' && !amount.includes('.')) return;
                if (e.key >= '0' && e.key <= '9') return;
                e.preventDefault();
              }}
              onChange={(e) => {
                const val = e.target.value;
                // Only allow valid numeric input (digits and single dot)
                if (val !== "" && !/^\d*\.?\d*$/.test(val)) return;
                if (val === "" || val === "0" || val === "0." || val === ".") {
                  setAmount(val);
                  return;
                }
                const num = parseFloat(val);
                if (isNaN(num) || num < 0) return;
                // Limit to 6 decimal places
                if (val.includes('.') && val.split('.')[1]?.length > 6) return;
                setAmount(val);
              }}
              placeholder="0.00"
              className="deposit-amount-input"
              disabled={isLoading || (activeTab === 'withdraw' && withdrawSource === 'custody' && wrongNetwork)}
            />
            <button
              className="deposit-max-btn"
              type="button"
              onClick={() => {
                if (activeTab === 'withdraw' && withdrawSource === 'hyperliquid') {
                  setAmount(hlUsdcBalance ?? "0");
                } else if (!wrongNetwork) {
                  handleMaxClick();
                }
              }}
              disabled={isLoading}
              style={{
                cursor: "pointer",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {isLoadingBalance || isLoadingHlBalance ? "..." : "MAX"}
            </button>
          </div>
        </div>

        {activeTab === 'withdraw' && withdrawSource === 'hyperliquid' && (
          <div style={{ fontSize: "12px", color: "#888", margin: "4px 0 8px" }}>
            <p style={{ margin: "0 0 4px" }}>Minimum withdrawal: 1 USDC. Funds arrive in ~15 minutes.</p>
            <p style={{ margin: 0, color: "#f59e0b" }}>Note: A ~1 USDC network fee is charged by Hyperliquid on every withdrawal. This is deducted from your amount — not a PerpX fee.</p>
          </div>
        )}

        <div className="deposit-info">
          <span className="deposit-info-label">
            {activeTab === 'deposit' ? 'Depositing to:' : 'Withdrawing to:'}
          </span>
          <span
            className={`deposit-info-address ${copiedAddress ? 'copied' : ''}`}
            onClick={() => {
              const addressToCopy = activeTab === 'deposit'
                ? custodyWalletAddress
                : account as string;
              if (addressToCopy) copyAddressToClipboard(addressToCopy);
            }}
            style={{ cursor: 'pointer' }}
          >
            {activeTab === 'deposit'
              ? `Your PerpX Wallet (${custodyWalletAddress.slice(0, 6)}...${custodyWalletAddress.slice(-4)})`
              : account ? `Your Connected Wallet (${account.slice(0, 6)}...${account.slice(-4)})` : 'N/A'
            }
            {copiedAddress && <span className="copy-indicator"> ✓</span>}
          </span>
        </div>

        {activeTab === 'deposit' && (
          <div className="deposit-clause" style={{ fontSize: 13, color: "#10b981", textAlign: "center", margin: "8px 0" }}>
            Arrives instantly · no PerpX fee
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="deposit-info" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span className="deposit-info-label">You receive</span>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                {amount && parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : "0.00"} {withdrawSource === 'hyperliquid' ? 'USDC' : selectedToken?.symbol || ''}
              </span>
            </div>
            {withdrawSource === 'hyperliquid' && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Typically ~15 min, up to ~1 hour during network congestion · track in Activity
              </div>
            )}
          </div>
        )}

        {activeTab === 'deposit' && !wrongNetwork && ethPriceUSD > 0 && (
          <div className="deposit-info" style={{ marginTop: 8, marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              <span className="deposit-info-label">Estimated Gas Fee</span>
              <span style={{ color: "#fff", fontWeight: 500, fontSize: 13 }}>
                ~{(0.0001 * (selectedToken?.isNative ? 21000 : 65000) / 21000).toFixed(5)} ETH (~${(0.0001 * (selectedToken?.isNative ? 21000 : 65000) / 21000 * ethPriceUSD).toFixed(2)})
              </span>
            </div>
          </div>
        )}


        <button
          className="deposit-button"
          onClick={
            activeTab === 'deposit' ? handleDeposit
            : withdrawSource === 'hyperliquid' ? handleHlWithdraw
            : handleWithdraw
          }
          disabled={
            isLoading || !amount ||
            (activeTab === 'withdraw' && withdrawSource === 'custody' && (wrongNetwork || !selectedToken))
          }
        >
          {isLoading ? (
            <>
              <span className="spinner"></span> Processing...
            </>
          ) : (
            activeTab === 'deposit' ? 'Deposit' : 'Withdraw'
          )}
        </button>

        {!account && (
          <div className="deposit-warning">Please connect your wallet</div>
        )}
      </div>
    </Modal>
  );
}