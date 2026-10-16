/**
 * API Hooks with Authentication
 *
 * This module provides hooks that automatically include authentication tokens
 * in API calls to the contract executor using the authenticated request pattern.
 */

import { useAuth } from "context/AuthContext/AuthContextProvider";
import {
  ReadContractParams,
  WriteContractParams
} from "./contractExecutor";

/**
 * Hook for authenticated contract reading
 *
 * Uses the authenticated request pattern with automatic token handling
 */
export function useAuthenticatedReadContract() {
  const { makeAuthenticatedRequest } = useAuth();

  return async (params: ReadContractParams): Promise<any> => {
    const { chainId = 42161, ...rest } = params;
    const rpcUrl = `https://arb1.arbitrum.io/rpc`; // Default RPC URL

    const response = await makeAuthenticatedRequest(`/api/admin/contract/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...rest,
        rpcUrl,
        args: rest.args || [],
      }),
    });

    if (!response) return null;

    const data = await response.json();
    if (!data.status) {
      throw new Error(data.message || "Contract read failed");
    }

    return data.data.result;
  };
}

/**
 * Hook for authenticated contract writing
 *
 * Uses the authenticated request pattern with automatic token handling
 */
export function useAuthenticatedWriteContract() {
  const { makeAuthenticatedRequest } = useAuth();

  return async (params: WriteContractParams): Promise<any> => {
    const { chainId = 42161, metadata, ...rest } = params;
    const rpcUrl = `https://arb1.arbitrum.io/rpc`; // Default RPC URL

    const requestBody = {
      ...rest,
      rpcUrl,
      args: rest.args || [],
      value: rest.value || "0",
      ...(metadata && { metadata }),
    };

    const response = await makeAuthenticatedRequest(`/api/admin/contract/write`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response) return null;

    const data = await response.json();
    if (!data.status) {
      throw new Error(data.message || "Contract write failed");
    }

    return data.data;
  };
}
