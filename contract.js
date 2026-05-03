/**
 * contract.js
 *
 * All smart contract interactions for ConfidentialVoteDAO.
 */

import { Contract } from "ethers";
import { state } from "./wallet.js";

// ── Contract Address ──────────────────────────────────────────────────────
export const CONTRACT_ADDRESS = "0x1B613A0a2bA99fafa82bCAeE8CC79552BDe08f5c";

// ── ABI ───────────────────────────────────────────────────────────────────
const ABI = [
  "function proposalCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function members(address) view returns (bool)",
  "function hasVoted(uint256, address) view returns (bool)",
  "function getProposal(uint256) view returns (string,string,address,uint256,uint256,uint8,bool,uint64,uint64,uint256)",
  "function getEncryptedHandles(uint256) view returns (bytes32,bytes32)",
  "function isVotingActive(uint256) view returns (bool)",
  "function createProposal(string,string) returns (uint256)",
  "function castVote(uint256,bytes32,bytes)",
  "function markResultDecryptable(uint256)",
  "function finalizeResult(uint256,uint64,uint64,bytes)",
  "function addMember(address)",
  "function removeMember(address)",
  "function transferOwnership(address)",
];

// ── Helpers: Read vs Write ─────────────────────────────────────────────────

// ✅ READ → provider
function getReadContract(addr) {
  if (!state.provider) throw new Error("Provider not ready");
  return new Contract(addr || CONTRACT_ADDRESS, ABI, state.provider);
}

// ✅ WRITE → fresh signer every time
async function getWriteContract(addr) {
  if (!state.provider) throw new Error("Provider not ready");

  const signer = await state.provider.getSigner(); // 🔥 always fresh
  return new Contract(addr || CONTRACT_ADDRESS, ABI, signer);
}

// ── Read functions ─────────────────────────────────────────────────────────

export async function getProposalCount(addr) {
  return getReadContract(addr).proposalCount();
}

export async function getProposal(id, addr) {
  return getReadContract(addr).getProposal(id);
}

export async function hasVoted(proposalId, voter, addr) {
  return getReadContract(addr).hasVoted(proposalId, voter);
}

export async function getMemberStatus(userAddress, addr) {
  const c = getReadContract(addr);

  const [isMember, ownerAddr] = await Promise.all([
    c.members(userAddress),
    c.owner(),
  ]);

  return {
    isMember,
    isOwner: ownerAddr.toLowerCase() === userAddress.toLowerCase(),
  };
}

export async function getEncryptedHandles(proposalId, addr) {
  return getReadContract(addr).getEncryptedHandles(proposalId);
}

// ── Write functions ────────────────────────────────────────────────────────

export async function createProposal(title, description, addr) {
  const contract = await getWriteContract(addr);
  const tx = await contract.createProposal(title, description);
  await tx.wait();
}

// 🔐 Cast encrypted vote
export async function castVote(proposalId, voteYes, contractAddress) {
  const instance = state.instance;
  if (!instance) throw new Error("FHE instance not ready");

  const addr = contractAddress || CONTRACT_ADDRESS;

  // 🔥 Always get fresh signer + address
  const signer = await state.provider.getSigner();
  const userAddress = await signer.getAddress();

  // 🔐 Create encrypted input bound to correct user
  const input = instance.createEncryptedInput(addr, userAddress);
  input.addBool(voteYes);

  const { handles, inputProof } = await input.encrypt();

  const contract = new Contract(addr, ABI, signer);

  const tx = await contract.castVote(proposalId, handles[0], inputProof);

  await tx.wait();
}

export async function markResultDecryptable(proposalId, addr) {
  const contract = await getWriteContract(addr);
  const tx = await contract.markResultDecryptable(proposalId);
  await tx.wait();
}

export async function finalizeResult(proposalId, addr) {
  const instance = state.instance;
  if (!instance) throw new Error("FHE instance not ready");

  const handles = await getEncryptedHandles(proposalId, addr);
  const encYesHandle = handles[0];
  const encNoHandle = handles[1];

  const result = await instance.publicDecrypt([encYesHandle, encNoHandle]);

  const clearYes = BigInt(result.clearValues[encYesHandle] ?? 0);
  const clearNo = BigInt(result.clearValues[encNoHandle] ?? 0);
  const proof = result.decryptionProof;

  const contract = await getWriteContract(addr);

  const tx = await contract.finalizeResult(
    proposalId,
    clearYes,
    clearNo,
    proof,
  );

  await tx.wait();

  return { clearYes, clearNo };
}

export async function addMember(memberAddress, addr) {
  const contract = await getWriteContract(addr);
  const tx = await contract.addMember(memberAddress);
  await tx.wait();
}
