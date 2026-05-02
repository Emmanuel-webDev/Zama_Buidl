/**
 * wallet.js
 *
 * Wallet connection — vanilla JS port of the connect() function
 * from the repo's useFhevm hook.
 */

import { BrowserProvider } from "ethers";
import { ensureInstance, clearInstance } from "./fhevm.js";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export const state = {
  provider: null,
  signer: null,
  address: "",
  instance: null,
};

/**
 * Switch MetaMask to Sepolia.
 * Adds the chain if it's not already in MetaMask (error code 4902).
 */
async function switchToSepolia() {
  if (!window.ethereum)
    throw new Error("MetaMask not found — please install it.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === SEPOLIA_CHAIN_ID) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia Testnet",
            nativeCurrency: {
              name: "Sepolia ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw new Error("Please switch MetaMask to the Sepolia testnet.");
    }
  }
}

/**
 * Connect wallet and initialize FHE instance.
 * Returns { address, instance } or throws.
 */
export async function connect() {
  if (!window.ethereum)
    throw new Error("MetaMask not found — please install it.");

  await switchToSepolia();

  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  // createInstance with { ...SepoliaConfig, network: window.ethereum }
  const instance = await ensureInstance();

  state.provider = provider;
  state.signer = signer;
  state.address = address;
  state.instance = instance;

  return { address, instance };
}

/**
 * Auto-connect if MetaMask already has authorized accounts.
 * Uses eth_accounts which never prompts.
 */
export async function autoConnect() {
  if (!window.ethereum) return false;
  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (Array.isArray(accounts) && accounts.length > 0) {
      await connect();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Re-sync on MetaMask account change.
 */
export async function resync() {
  if (!window.ethereum) return;
  try {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const instance = await ensureInstance();
    state.provider = provider;
    state.signer = signer;
    state.address = address;
    state.instance = instance;
    return { address, instance };
  } catch {
    /* ignore */
  }
}

/**
 * Register MetaMask event listeners.
 * Pass callbacks to respond to account and chain changes.
 */
export function registerListeners({ onAccountChange, onChainChange }) {
  if (!window.ethereum) return;

  window.ethereum.on("accountsChanged", async () => {
    await resync();
    onAccountChange?.();
  });

  window.ethereum.on("chainChanged", async () => {
    clearInstance();
    state.instance = null;
    await resync();
    onChainChange?.();
  });
}
