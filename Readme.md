# 🗳️ ConfidentialVoteDAO

**Private governance powered by Fully Homomorphic Encryption (FHE).**

ConfidentialVoteDAO is a decentralized governance system built on **Zama fhEVM**, where votes are encrypted before they ever touch the blockchain. The smart contract tallies votes **without decrypting them**, ensuring that individual ballots remain permanently private.

> Public proposals. Private ballots. Legitimate outcomes.

---

## 🚀 Overview

Traditional DAO voting systems expose user votes on-chain. This creates serious problems:

- ❌ Vote buying and bribery  
- ❌ Coercion and social pressure  
- ❌ Loss of voter independence  

**ConfidentialVoteDAO solves this using FHE.**

Votes are:
- Encrypted **client-side**
- Computed **on-chain (while still encrypted)**
- Decrypted **only as a final aggregate result**

---

## 🔐 How It Works

### 1. Proposal Creation
Any DAO member creates a proposal:
```solidity
function createProposal(string calldata title, string calldata description)
```

- Metadata is public (title, description)
- Voting window is initialized
- Encrypted vote counters start at 0

---

### 2. Casting Votes (Encrypted)
Votes are encrypted in the browser using Zama’s SDK:

```js
const input = instance.createEncryptedInput(contractAddress, userAddress);
input.addBool(true); // YES or NO
const { handles, inputProof } = await input.encrypt();
```

Then submitted on-chain:

```solidity
function castVote(uint256 proposalId, externalEbool encryptedVote, bytes calldata inputProof)
```

#### 🔑 Important:
- The contract **never sees the vote**
- Only ciphertext is stored
- A ZK proof ensures validity

---

### 3. Encrypted Tallying (On-Chain)

Votes are accumulated using FHE operations:

```solidity
euint64 yesIncrement = FHE.select(vote, one, zero);
euint64 noIncrement  = FHE.select(vote, zero, one);

p.encYesVotes = FHE.add(p.encYesVotes, yesIncrement);
p.encNoVotes  = FHE.add(p.encNoVotes,  noIncrement);
```

- `FHE.select` acts like a conditional — on encrypted data
- `FHE.add` accumulates totals — without decryption

---

### 4. Mark Result Decryptable

After voting ends:

```solidity
function markResultDecryptable(uint256 proposalId)
```

- Enables public decryption of encrypted tallies
- Emits encrypted handles

---

### 5. Off-Chain Decryption (Zama Relayer)

Frontend calls:

```js
const result = await instance.publicDecrypt([
  encYesHandle,
  encNoHandle
]);
```

Returns:
- Clear vote counts
- Cryptographic proof

---

### 6. Finalize Result On-Chain

```solidity
function finalizeResult(
  uint256 proposalId,
  uint64 clearYesVotes,
  uint64 clearNoVotes,
  bytes calldata proof
)
```

- Verifies proof using `FHE.checkSignatures`
- Stores final result permanently

---

## 🧠 Architecture

```
User Browser
   ↓ (Encrypt vote)
fhevmjs SDK
   ↓
Smart Contract (fhEVM)
   ↓ (Encrypted computation)
Zama Relayer + KMS
   ↓ (Threshold decryption)
Frontend → finalizeResult()
```

---

## 🛠️ Tech Stack

- **Solidity (0.8.24)**
- **Zama fhEVM (FHE library)**
- **fhevmjs (client encryption SDK)**
- **Ethers.js v6**
- **Sepolia Testnet**
- Vanilla JS frontend

---

## 📦 Features

- 🔐 Fully encrypted voting (YES/NO)
- 🧮 On-chain encrypted tallying
- 👥 DAO membership control
- 🗳️ Proposal lifecycle management
- 🔓 Threshold decryption via Zama KMS
- ✅ On-chain proof verification
- ⚡ Responsive UI with loading states

---

## ⚙️ Installation

### 1. Clone the repo
```bash
git clone https://github.com/Emmanuel-webDev/Zama_Buidl.git
cd confidential-vote-dao
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run frontend
```bash
npm run dev
```

---

## 🔑 Environment Setup

Make sure:
- You are connected to **Sepolia**
- Your wallet has test ETH
- You initialize fhevm properly in your frontend

---

## 🧪 Usage Flow

1. Connect wallet  
2. Create proposal  
3. Add members  
4. Members vote (encrypted)  
5. Wait for voting to end  
6. Mark proposal decryptable  
7. Decrypt & finalize result  

---

## ⚠️ Known Limitations

- ⏱️ FHE operations introduce latency (encryption + relayer)
- 🌐 Relayer availability affects UX
- 🔄 Breaking changes may occur due to active Zama upgrades

---

## 🧱 Smart Contract Highlights

- Uses `ZamaEthereumConfig`
- Implements **self-relaying decryption flow**
- Enforces:
  - One vote per member
  - Voting window constraints
  - Proof verification

---

## 🔗 Links

- 🌐 Zama Docs: https://docs.zama.org  
- 💻 Zama SDK: https://github.com/zama-ai/sdk  
- 📜 Contract (Sepolia)
- 🖥️ Frontend: *Add your deployed URL*  
- 📦 Repo: *This repository*

---

## 🎯 Why This Matters

ConfidentialVoteDAO introduces **true private governance**:

- No vote visibility
- No manipulation
- No coercion

Unlike:
- ❌ Transparent voting (fully public)
- ❌ ZK-only systems (prove correctness, not compute privately)
- ❌ Trusted execution (hardware assumptions)

This uses:
> **Fully Homomorphic Encryption — computation directly on encrypted data**

---

## 🏁 Conclusion

ConfidentialVoteDAO demonstrates the future of governance:

> Transparent decisions.  
> Private participation.  
> Trustless execution.

---

## 🙌 Acknowledgements

- Zama team for fhEVM  
- Open-source cryptography community  
- Ethereum ecosystem  

---

## 🧑‍💻 Author

Built by **Chinonso Onuorah**  
For **Zama Mainnet Builder Season 2**
