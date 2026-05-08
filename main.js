/**
 * main.js — ConfidentialVoteDAO entry point
 *
 * Wires wallet, FHE instance, contract calls, and UI together.
 * Follows the pattern from ELLA0VICTOR/fhex402.
 */

import { connect, autoConnect, registerListeners, state } from "./wallet.js";
import {
  getProposalCount,
  getProposal,
  hasVoted,
  //getMemberStatus,
  createProposal,
  castVote,
  markResultDecryptable,
  finalizeResult,
  //addMember,
} from "./contract.js";
import { showToast, setButtonLoading, renderProposalCard } from "./ui.js";

// ── Contract address ──────────────────────────────────────────────────────────
// PASTE YOUR DEPLOYED SEPOLIA CONTRACT ADDRESS HERE
let contractAddress = "0xe9c66d48525f828A77A8e2d8A97bEF56B8d7d70f";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const connectBtn = document.getElementById("connectBtn");
const contractInput = document.getElementById("contractAddress");
const userAddressEl = document.getElementById("userAddress");
const memberStatusEl = document.getElementById("memberStatus");
const fheStatusEl = document.getElementById("fheStatus");
const statProposalsEl = document.getElementById("statProposals");
const proposalsListEl = document.getElementById("proposalsList");
const createBtnEl = document.getElementById("createBtn");
const refreshBtnEl = document.getElementById("refreshBtn");
const addMemberBtnEl = document.getElementById("addMemberBtn");
addMemberBtnEl.disabled = true; // Disable member management for demo submission
const newMemberAddrEl = document.getElementById("newMemberAddr");
const propTitleEl = document.getElementById("propTitle");
const propDescEl = document.getElementById("propDesc");

// ── Update UI after connect ───────────────────────────────────────────────────
function updateConnectedUI() {
  connectBtn.textContent =
    state.address.slice(0, 6) + "..." + state.address.slice(-4);
  connectBtn.classList.add("connected");
  userAddressEl.value = state.address;
  fheStatusEl.value = state.instance ? "✅ FHE Ready" : "⏳ Initializing...";
}

/* Disabled for demo submission - uncomment to enable in your own project
async function updateMembership() {
  if (
    !state.address ||
    contractAddress === "0x0000000000000000000000000000000000000000"
  )
    return;
  try {
    const { isMember, isOwner } = await getMemberStatus(
      state.address,
      contractAddress,
    );
    memberStatusEl.value = isMember
      ? isOwner
        ? "✅ Member + Owner"
        : "✅ Member"
      : "❌ Not a Member";
  } catch {
    memberStatusEl.value = "Unable to check";
  }
}
*/

// ── Proposals ─────────────────────────────────────────────────────────────────
async function loadProposals() {
  if (
    !state.signer ||
    contractAddress === "0x0000000000000000000000000000000000000000"
  )
    return;

  proposalsListEl.innerHTML =
    '<div class="empty-state"><span class="spinner"></span> Loading...</div>';

  try {
    const count = await getProposalCount(contractAddress);
    statProposalsEl.textContent = count.toString();

    if (count === 0n) {
      proposalsListEl.innerHTML =
        '<div class="empty-state">No proposals yet. Create the first one!</div>';
      return;
    }

    proposalsListEl.innerHTML = "";

    for (let i = Number(count); i >= 1; i--) {
      const p = await getProposal(i, contractAddress);
      const voted = state.address
        ? await hasVoted(i, state.address, contractAddress)
        : false;

      const card = renderProposalCard(
        p,
        i,
        voted,
        handleVote,
        handleMarkDecryptable,
        handleFinalizeResult,
      );
      proposalsListEl.appendChild(card);
    }
  } catch (e) {
    proposalsListEl.innerHTML = `<div class="empty-state" style="color:var(--no)">Failed to load: ${e.message}</div>`;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function handleConnect() {
  if (!window.ethereum) {
    showToast("MetaMask not found — please install it.", "error");
    return;
  }
  setButtonLoading(connectBtn, true, "Connect Wallet");
  try {
    await connect();
    updateConnectedUI();
    //await updateMembership();
    if (contractAddress !== "0x0000000000000000000000000000000000000000") {
      await loadProposals();
    }
    // Update FHE status after instance creation
    fheStatusEl.value = state.instance ? "✅ FHE Ready" : "❌ FHE Failed";
    showToast("✅ Wallet connected", "success");
  } catch (e) {
    showToast(e.message, "error");
  } finally {
    setButtonLoading(
      connectBtn,
      false,
      state.address
        ? state.address.slice(0, 6) + "..." + state.address.slice(-4)
        : "Connect Wallet",
    );
    if (state.address) connectBtn.classList.add("connected");
  }
}

async function handleCreateProposal() {
  if (!state.signer) {
    showToast("Connect wallet first", "error");
    return;
  }
  const title = propTitleEl.value.trim();
  const desc = propDescEl.value.trim();
  if (!title) {
    showToast("Please enter a title", "error");
    return;
  }
  if (!desc) {
    showToast("Please enter a description", "error");
    return;
  }
  setButtonLoading(createBtnEl, true, "Submit Proposal");
  try {
    await createProposal(title, desc, contractAddress);
    showToast("✅ Proposal created!", "success");
    propTitleEl.value = "";
    propDescEl.value = "";
    await loadProposals();
  } catch (e) {
    showToast("Failed: " + (e.reason || e.message), "error");
  } finally {
    setButtonLoading(createBtnEl, false, "Submit Proposal");
  }
}

async function handleVote(proposalId, voteYes, container) {
  if (!state.instance) {
    showToast("FHE not ready — wait a moment and try again", "error");
    return;
  }

  // 🔒 Disable BOTH buttons immediately
  const buttons = container.querySelectorAll("button");
  buttons.forEach((b) => {
    b.disabled = true;
    b.innerHTML = '<span class="spinner"></span>';
  });

  try {
    showToast("🔐 Encrypting your vote locally...", "info");

    await castVote(proposalId, voteYes, contractAddress);

    showToast(
      "✅ Vote cast! Your ballot is encrypted and permanently secret.",
      "success",
    );

    await loadProposals();
  } catch (e) {
    const msg = e.reason || e.message || "";

    if (msg.includes("AlreadyVoted"))
      showToast("You already voted on this proposal", "error");
    else if (msg.includes("WrongStatus"))
      showToast("Proposal is not accepting votes", "error");
    else if (msg.includes("VotingNotActive"))
      showToast("Voting period has closed", "error");
    else if (msg.includes("SenderNotAllowed"))
      showToast("ACL error — check contract address is correct", "error");
    else showToast("Vote failed: " + msg, "error");
  } finally {
    // 🔓 Re-enable buttons ONLY if still on same UI
    buttons[0].innerHTML = "🔐 Vote YES";
    buttons[1].innerHTML = "🔐 Vote NO";
    buttons.forEach((b) => (b.disabled = false));
  }
}

async function handleMarkDecryptable(proposalId, btn) {
  if (!state.signer) {
    showToast("Connect wallet first", "error");
    return;
  }

  setButtonLoading(btn, true, "🔓 Close & Mark Decryptable");

  showToast("Closing voting...", "info");
  try {
    await markResultDecryptable(proposalId, contractAddress);
    showToast("✅ Done. Click Decrypt & Finalize to reveal result.", "success");
    await loadProposals();
  } catch (e) {
    showToast("Failed: " + (e.reason || e.message), "error");
  } finally {
    setButtonLoading(btn, false, "🔓 Close & Mark Decryptable");
  }
}

async function handleFinalizeResult(proposalId, btn) {
  if (!state.instance) {
    showToast("FHE not ready", "error");
    return;
  }

  setButtonLoading(btn, true, "🔓 Decrypt & Finalize");

  showToast("🔓 Requesting decryption from Zama KMS...", "info");
  try {
    const { clearYes, clearNo } = await finalizeResult(
      proposalId,
      contractAddress,
    );
    showToast(`✅ Result: YES ${clearYes} | NO ${clearNo}`, "success");
    await loadProposals();
  } catch (e) {
    const msg = e.reason || e.message || "";
    if (msg.includes("WrongStatus"))
      showToast("Call Mark Decryptable first", "error");
    else if (msg.includes("InvalidKMS"))
      showToast("KMS proof verification failed", "error");
    else showToast("Finalize failed: " + msg, "error");
  } finally {
    setButtonLoading(btn, false, "🔓 Decrypt & Finalize");
  }
}

/* Disabled for demo submission - uncomment to enable in your own project
async function handleAddMember() {
  if (!state.signer) {
    showToast("Connect wallet first", "error");
    return;
  }
  const addr = newMemberAddrEl.value.trim();
  if (!addr.startsWith("0x") || addr.length !== 42) {
    showToast("Invalid address", "error");
    return;
  }
  try {
    await addMember(addr, contractAddress);
    showToast("✅ Member added", "success");
    newMemberAddrEl.value = "";
    await updateMembership();
  } catch (e) {
    showToast("Failed: Not an Admin", "error");
  }
}
*/

function handleContractAddressChange() {
  const val = contractInput.value.trim();
  if (val.startsWith("0x") && val.length === 42) {
    contractAddress = val;
    resetContract();
    if (state.signer) {
      loadProposals();
      //updateMembership();
    }
  }
}

// ── Register listeners ────────────────────────────────────────────────────────
connectBtn.addEventListener("click", handleConnect);
createBtnEl.addEventListener("click", handleCreateProposal);
refreshBtnEl.addEventListener("click", loadProposals);
//addMemberBtnEl.addEventListener("click", handleAddMember);
contractInput.addEventListener("change", handleContractAddressChange);

registerListeners({
  onAccountChange: () => {
    updateConnectedUI();
    updateMembership();
    loadProposals();
  },
  onChainChange: () => {
    updateConnectedUI();
    loadProposals();
  },
});

// ── Auto-fill contract address ─────────────────────────────────────────────────
if (contractAddress !== "0x0000000000000000000000000000000000000000") {
  contractInput.value = contractAddress;
}

// ── Auto-connect on page load ─────────────────────────────────────────────────
autoConnect().then((connected) => {
  if (connected) {
    updateConnectedUI();
    //updateMembership();
    loadProposals();
  }
});
