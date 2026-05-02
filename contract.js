/**
 * contract.js
 *
 * All smart contract interactions for ConfidentialVoteDAO.
 */

import { Contract } from "ethers";
import { state } from "./wallet.js";

// PASTE YOUR DEPLOYED SEPOLIA CONTRACT ADDRESS HERE
export const CONTRACT_ADDRESS = "0x1B613A0a2bA99fafa82bCAeE8CC79552BDe08f5c";

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

let _contract = null;

export function getContract(address) {
  if (!state.signer) throw new Error("Wallet not connected");
  const addr = address || CONTRACT_ADDRESS;
  if (!_contract || _contract.target !== addr) {
    _contract = new Contract(addr, ABI, state.signer);
  }
  return _contract;
}

export function resetContract() {
  _contract = null;
}

// ── Read functions ─────────────────────────────────────────────────────────

export async function getProposalCount(addr) {
  return getContract(addr).proposalCount();
}

export async function getProposal(id, addr) {
  return getContract(addr).getProposal(id);
}

export async function hasVoted(proposalId, voter, addr) {
  return getContract(addr).hasVoted(proposalId, voter);
}

export async function getMemberStatus(userAddress, addr) {
  const c = getContract(addr);
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
  return getContract(addr).getEncryptedHandles(proposalId);
}

// ── Write functions ────────────────────────────────────────────────────────

export async function createProposal(title, description, addr) {
  const tx = await getContract(addr).createProposal(title, description);
  await tx.wait();
}

/**
 * Cast an FHE-encrypted vote.
 *
 * Follows the exact pattern from the repo:
 *   const input = instance.createEncryptedInput(contractAddress, userAddress)
 *   input.addBool(true/false)
 *   const { handles, inputProof } = await input.encrypt()
 *   contract.castVote(proposalId, handles[0], inputProof)
 */
export async function castVote(proposalId, voteYes, contractAddress) {
  const instance = state.instance;
  if (!instance) throw new Error("FHE instance not ready");

  const addr = contractAddress || CONTRACT_ADDRESS;

  // createEncryptedInput binds to this specific contract + this specific voter
  const input = instance.createEncryptedInput(addr, state.address);
  input.addBool(voteYes); // true = YES, false = NO
  const { handles, inputProof } = await input.encrypt();

  const tx = await getContract(addr).castVote(
    proposalId,
    handles[0],
    inputProof,
  );
  await tx.wait();
}

export async function markResultDecryptable(proposalId, addr) {
  const tx = await getContract(addr).markResultDecryptable(proposalId);
  await tx.wait();
}

/**
 * Finalize result using publicDecrypt.
 *
 * Follows the exact pattern from the repo:
 *   instance.publicDecrypt([encYesHandle, encNoHandle])
 *   result.clearValues[handle] and result.decryptionProof
 */
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

  const tx = await getContract(addr).finalizeResult(
    proposalId,
    clearYes,
    clearNo,
    proof,
  );
  await tx.wait();

  return { clearYes, clearNo };
}

export async function addMember(memberAddress, addr) {
  const tx = await getContract(addr).addMember(memberAddress);
  await tx.wait();
}
