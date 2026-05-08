/**
 * contract.js
 *
 * All smart contract interactions for ConfidentialVoteDAO.
 */

import { Contract } from "ethers";
import { state } from "./wallet.js";

// ── Contract Address ──────────────────────────────────────────────────────
export const CONTRACT_ADDRESS = "0xe9c66d48525f828A77A8e2d8A97bEF56B8d7d70f";

// ── ABI ───────────────────────────────────────────────────────────────────
const ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "member",
        type: "address",
      },
    ],
    name: "addMember",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "AlreadyMember",
    type: "error",
  },
  {
    inputs: [],
    name: "AlreadyVoted",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        internalType: "externalEbool",
        name: "encryptedVote",
        type: "bytes32",
      },
      {
        internalType: "bytes",
        name: "inputProof",
        type: "bytes",
      },
    ],
    name: "castVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
    ],
    name: "createProposal",
    outputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        internalType: "uint64",
        name: "clearYesVotes",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "clearNoVotes",
        type: "uint64",
      },
      {
        internalType: "bytes",
        name: "publicDecryptProof",
        type: "bytes",
      },
    ],
    name: "finalizeResult",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "InvalidKMSSignatures",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "markResultDecryptable",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "NotAMember",
    type: "error",
  },
  {
    inputs: [],
    name: "NotMember",
    type: "error",
  },
  {
    inputs: [],
    name: "NotOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "ProposalNotFound",
    type: "error",
  },
  {
    inputs: [],
    name: "QuorumNotMet",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "member",
        type: "address",
      },
    ],
    name: "removeMember",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "handle",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "SenderNotAllowedToUseHandle",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "VotingNotActive",
    type: "error",
  },
  {
    inputs: [],
    name: "VotingStillActive",
    type: "error",
  },
  {
    inputs: [],
    name: "WrongStatus",
    type: "error",
  },
  {
    inputs: [],
    name: "ZamaProtocolUnsupported",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "member",
        type: "address",
      },
    ],
    name: "MemberAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "member",
        type: "address",
      },
    ],
    name: "MemberRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "proposer",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "endTime",
        type: "uint256",
      },
    ],
    name: "ProposalCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32[]",
        name: "handlesList",
        type: "bytes32[]",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "abiEncodedCleartexts",
        type: "bytes",
      },
    ],
    name: "PublicDecryptionVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "encYesHandle",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "encNoHandle",
        type: "bytes32",
      },
    ],
    name: "ResultDecryptable",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "yesVotes",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "noVotes",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "passed",
        type: "bool",
      },
    ],
    name: "ResultFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "voter",
        type: "address",
      },
    ],
    name: "VoteCast",
    type: "event",
  },
  {
    inputs: [],
    name: "confidentialProtocolId",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "getEncryptedHandles",
    outputs: [
      {
        internalType: "bytes32",
        name: "encYesHandle",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "encNoHandle",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "getProposal",
    outputs: [
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "address",
        name: "proposer",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "startTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "endTime",
        type: "uint256",
      },
      {
        internalType: "enum ConfidentialVoteDAO.ProposalStatus",
        name: "status",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "passed",
        type: "bool",
      },
      {
        internalType: "uint64",
        name: "clearYesVotes",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "clearNoVotes",
        type: "uint64",
      },
      {
        internalType: "uint256",
        name: "totalVoters",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "voter",
        type: "address",
      },
    ],
    name: "hasVoted",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "proposalId",
        type: "uint256",
      },
    ],
    name: "isVotingActive",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "members",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MIN_QUORUM",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proposalCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "proposals",
    outputs: [
      {
        internalType: "string",
        name: "title",
        type: "string",
      },
      {
        internalType: "string",
        name: "description",
        type: "string",
      },
      {
        internalType: "address",
        name: "proposer",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "startTime",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "endTime",
        type: "uint256",
      },
      {
        internalType: "euint64",
        name: "encYesVotes",
        type: "bytes32",
      },
      {
        internalType: "euint64",
        name: "encNoVotes",
        type: "bytes32",
      },
      {
        internalType: "uint64",
        name: "clearYesVotes",
        type: "uint64",
      },
      {
        internalType: "uint64",
        name: "clearNoVotes",
        type: "uint64",
      },
      {
        internalType: "enum ConfidentialVoteDAO.ProposalStatus",
        name: "status",
        type: "uint8",
      },
      {
        internalType: "bool",
        name: "passed",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "totalVoters",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "VOTING_DURATION",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
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
