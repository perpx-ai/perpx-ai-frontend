/**
 * Contract Wrapper Utilities
 *
 * This module provides wrapper functions that maintain backward compatibility
 * with the existing contract calling interface while using the backend API
 */

import { ethers } from "ethers";
import { readContract, writeContract, ReadContractParams, WriteContractParams } from "./contractExecutor";

/**
 * Options for contract calls
 */
export interface ContractCallOptions {
  value?: bigint | string;
  gasLimit?: bigint | string;
  maxFeePerGas?: bigint | string;
  maxPriorityFeePerGas?: bigint | string;
}

/**
 * Convert bigint to string for API
 */
function bigIntToString(value: bigint | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Create a contract proxy that routes calls through the backend API
 * This maintains the same interface as ethers.Contract
 *
 * @param userAddress - User's wallet address
 * @param contractAddress - Contract address
 * @param contractName - Contract name (must match backend ABI)
 * @param chainId - Chain ID
 *
 * @example
 * const contract = createContractProxy(
 *   userAddress,
 *   "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
 *   "IERC20",
 *   42161
 * );
 * const balance = await contract.balanceOf(userAddress);
 * const tx = await contract.transfer(recipient, amount);
 */
export function createContractProxy(
  userAddress: string,
  contractAddress: string,
  contractName: string,
  chainId: number = 42161
): any {
  return new Proxy(
    {},
    {
      get(target, prop: string) {
        if (prop === "address") {
          return contractAddress;
        }

        if (prop === "interface") {
          // Return a minimal interface object
          return {
            getFunction: (name: string) => ({ name }),
          };
        }

        // Return a function that will be called when contract.methodName() is invoked
        return async (...args: any[]) => {
          // Extract options if the last argument is an object with known option keys
          let options: ContractCallOptions | undefined;
          let actualArgs = args;

          if (args.length > 0) {
            const lastArg = args[args.length - 1];
            if (
              lastArg &&
              typeof lastArg === "object" &&
              (lastArg.value !== undefined ||
                lastArg.gasLimit !== undefined ||
                lastArg.maxFeePerGas !== undefined ||
                lastArg.maxPriorityFeePerGas !== undefined)
            ) {
              options = lastArg;
              actualArgs = args.slice(0, -1);
            }
          }

          // Determine if this is a read or write operation
          // We'll try to read first, and if that fails with specific errors, we'll write
          try {
            const result = await readContract({
              userAddress,
              contractAddress,
              contractName,
              functionName: prop,
              args: actualArgs,
              chainId,
            });

            return result;
          } catch (error: any) {
            // If the function is not view/pure, it will fail to read
            // In that case, attempt a write operation
            if (
              error.message?.includes("function is not view or pure") ||
              error.message?.includes("not a view function") ||
              error.message?.includes("state-changing")
            ) {
              const result = await writeContract({
                userAddress,
                contractAddress,
                contractName,
                functionName: prop,
                args: actualArgs,
                chainId,
                value: bigIntToString(options?.value),
                gasLimit: bigIntToString(options?.gasLimit),
                maxFeePerGas: bigIntToString(options?.maxFeePerGas),
                maxPriorityFeePerGas: bigIntToString(options?.maxPriorityFeePerGas),
              });

              // Return a transaction-like object
              return {
                hash: result.transactionHash,
                wait: async () => ({
                  transactionHash: result.transactionHash,
                  blockNumber: result.blockNumber,
                  gasUsed: ethers.getBigInt(result.gasUsed),
                  status: result.status === "success" ? 1 : 0,
                  from: result.from,
                  to: result.to,
                }),
              };
            }

            // Re-throw other errors
            throw error;
          }
        };
      },
    }
  );
}

/**
 * Execute a read-only contract call
 *
 * @param params - Contract read parameters
 * @returns Result from the contract function
 */
export async function executeContractRead(params: ReadContractParams): Promise<any> {
  return readContract(params);
}

/**
 * Execute a write contract call (transaction)
 *
 * @param params - Contract write parameters
 * @returns Transaction result with hash and wait function
 */
export async function executeContractWrite(
  params: WriteContractParams
): Promise<{
  hash: string;
  wait: () => Promise<{
    transactionHash: string;
    blockNumber: number;
    gasUsed: bigint;
    status: number;
    from: string;
    to: string;
  }>;
}> {
  const result = await writeContract(params);

  return {
    hash: result.transactionHash,
    wait: async () => ({
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      gasUsed: ethers.getBigInt(result.gasUsed),
      status: result.status === "success" ? 1 : 0,
      from: result.from,
      to: result.to,
    }),
  };
}

/**
 * Encode function data for a contract call
 * This is useful when you need to get the calldata without executing
 *
 * Note: This still requires ethers for encoding, but doesn't make any blockchain calls
 */
export function encodeContractData(
  contractInterface: ethers.Interface,
  functionName: string,
  args: any[]
): string {
  return contractInterface.encodeFunctionData(functionName, args);
}

/**
 * Decode function result
 */
export function decodeContractResult(
  contractInterface: ethers.Interface,
  functionName: string,
  data: string
): ethers.Result {
  return contractInterface.decodeFunctionResult(functionName, data);
}
