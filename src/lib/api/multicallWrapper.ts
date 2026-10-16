/**
 * Multicall Wrapper for Backend API
 *
 * This module provides a wrapper for batch reading contract data via the backend API
 * It maintains compatibility with the existing multicall interface
 */

import { batchReadContracts, ReadContractParams } from "./contractExecutor";

/**
 * Multicall request structure
 */
export interface MulticallRequest {
  [contractAddress: string]: {
    abiId: string;
    calls: {
      [methodName: string]: {
        params?: any[];
      };
    };
  };
}

/**
 * Multicall result structure
 */
export interface MulticallResult {
  [contractAddress: string]: {
    [methodName: string]: {
      returnValues: any[];
      success: boolean;
      error?: string;
    };
  };
}

/**
 * Execute multicall via backend API
 *
 * This function converts the existing multicall format to individual API calls
 * and batches them together for efficiency
 *
 * @param chainId - Chain ID
 * @param userAddress - User's wallet address
 * @param multicallRequest - Multicall request object
 * @returns Multicall results
 *
 * @example
 * const result = await executeMulticallViaAPI(42161, userAddress, {
 *   "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": {
 *     abiId: "IERC20",
 *     calls: {
 *       balanceOf: { params: [userAddress] },
 *       totalSupply: { params: [] }
 *     }
 *   }
 * });
 */
export async function executeMulticallViaAPI(
  chainId: number,
  userAddress: string,
  multicallRequest: MulticallRequest
): Promise<MulticallResult> {
  // Convert multicall request to individual read contract calls
  const calls: ReadContractParams[] = [];
  const callMetadata: Array<{ contractAddress: string; methodName: string }> = [];

  for (const [contractAddress, contractData] of Object.entries(multicallRequest)) {
    for (const [methodName, callData] of Object.entries(contractData.calls)) {
      calls.push({
        userAddress,
        contractAddress,
        contractName: contractData.abiId,
        functionName: methodName,
        args: callData.params || [],
        chainId,
      });

      callMetadata.push({ contractAddress, methodName });
    }
  }

  // Execute all calls in batch
  try {
    const results = await batchReadContracts(calls);

    // Convert results back to multicall format
    const multicallResult: MulticallResult = {};

    results.forEach((result, index) => {
      const { contractAddress, methodName } = callMetadata[index];

      if (!multicallResult[contractAddress]) {
        multicallResult[contractAddress] = {};
      }

      multicallResult[contractAddress][methodName] = {
        returnValues: Array.isArray(result) ? result : [result],
        success: true,
      };
    });

    return multicallResult;
  } catch (error: any) {
    // Handle errors by marking all calls as failed
    const multicallResult: MulticallResult = {};

    callMetadata.forEach(({ contractAddress, methodName }) => {
      if (!multicallResult[contractAddress]) {
        multicallResult[contractAddress] = {};
      }

      multicallResult[contractAddress][methodName] = {
        returnValues: [],
        success: false,
        error: error.message || "Unknown error",
      };
    });

    return multicallResult;
  }
}

/**
 * Execute a simplified multicall for a single contract
 *
 * @param chainId - Chain ID
 * @param userAddress - User's wallet address
 * @param contractAddress - Contract address
 * @param contractName - Contract name (ABI ID)
 * @param calls - Object mapping method names to parameters
 * @returns Object mapping method names to results
 *
 * @example
 * const results = await executeContractMulticall(
 *   42161,
 *   userAddress,
 *   "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   "IERC20",
 *   {
 *     balanceOf: [userAddress],
 *     totalSupply: [],
 *     decimals: []
 *   }
 * );
 * console.log(results.balanceOf); // Balance result
 * console.log(results.totalSupply); // Total supply result
 */
export async function executeContractMulticall(
  chainId: number,
  userAddress: string,
  contractAddress: string,
  contractName: string,
  calls: Record<string, any[]>
): Promise<Record<string, any>> {
  const multicallRequest: MulticallRequest = {
    [contractAddress]: {
      abiId: contractName,
      calls: Object.fromEntries(Object.entries(calls).map(([method, params]) => [method, { params }])),
    },
  };

  const result = await executeMulticallViaAPI(chainId, userAddress, multicallRequest);

  // Flatten the result for easier access
  const flatResult: Record<string, any> = {};
  for (const [methodName, callResult] of Object.entries(result[contractAddress])) {
    if (callResult.success) {
      flatResult[methodName] = callResult.returnValues.length === 1 ? callResult.returnValues[0] : callResult.returnValues;
    } else {
      flatResult[methodName] = null;
    }
  }

  return flatResult;
}
