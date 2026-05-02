/**
 * fhevm.js
 *
 * Zama relayer-sdk initialization — vanilla JS port of the repo's useFhevm hook.
 *
 * KEY FACTS (learned from ELLA0VICTOR/fhex402 repo):
 *   1. Import from "@zama-fhe/relayer-sdk/web" — NOT from "@zama-fhe/relayer-sdk"
 *   2. Call initSDK() FIRST before createInstance()
 *   3. initSDK() loads WASM — must be served via a bundler (Vite handles this)
 *   4. createInstance({ ...SepoliaConfig, network: window.ethereum })
 *   5. Cache the instance — only create once per page load
 *   6. Pre-warm initSDK() on module load so WASM is ready before user clicks Connect
 */

import {
  initSDK,
  createInstance,
  SepoliaConfig,
} from "@zama-fhe/relayer-sdk/web";

// Module-level cache — one instance per page load
let cachedInstance = null;
let sdkInitialized = false;
let sdkInitPromise = null;

/**
 * Load the WASM cryptographic engine.
 * Safe to call multiple times — resolves immediately after first call.
 */
export async function ensureSDK() {
  if (sdkInitialized) return;

  // Prevent concurrent calls from triggering multiple inits
  if (sdkInitPromise) return sdkInitPromise;

  sdkInitPromise = (async () => {
    try {
      await initSDK();
      sdkInitialized = true;
      console.log("[fhevm] WASM SDK initialized");
    } catch (e) {
      console.error("[fhevm] initSDK failed:", e);
      sdkInitPromise = null;
      throw e;
    }
  })();

  return sdkInitPromise;
}

/**
 * Create (or return cached) FhevmInstance.
 * window.ethereum must exist before calling this.
 *
 * Follows exact pattern from ELLA0VICTOR/fhex402:
 *   createInstance({ ...SepoliaConfig, network: window.ethereum })
 */
export async function ensureInstance() {
  if (cachedInstance) return cachedInstance;
  if (!window.ethereum)
    throw new Error("MetaMask not found — please install it.");

  await ensureSDK();

  cachedInstance = await createInstance({
    ...SepoliaConfig,
    network: window.ethereum, // Required EIP-1193 provider
  });

  if (
    !cachedInstance ||
    typeof cachedInstance.createEncryptedInput !== "function"
  ) {
    cachedInstance = null;
    throw new Error("FHE instance invalid — createEncryptedInput missing");
  }

  console.log("[fhevm] Instance created successfully");
  return cachedInstance;
}

/**
 * Clear cached instance (call on chain change).
 */
export function clearInstance() {
  cachedInstance = null;
}

// Pre-warm WASM on module import — so it's ready before the user clicks Connect
ensureSDK().catch((e) => console.warn("[fhevm] pre-warm failed:", e));
