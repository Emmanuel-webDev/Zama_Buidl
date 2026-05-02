// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title  ConfidentialVoteDAO
 * @notice A DAO governance contract where votes are fully encrypted using
 *         Zama fhEVM v0.9. Individual ballots are impossible to read.
 *         Only the final aggregate tally is ever revealed.
 *
 * @dev    Built with the fhEVM v0.9 self-relaying decryption pattern.
 *
 *         VOTING FLOW:
 *         1. Owner creates proposal  - encrypted yes/no counters initialized
 *         2. Members cast votes      - FHE.add() accumulates encrypted tallies
 *         3. Voting period ends      - member calls markResultDecryptable()
 *         4. Off-chain client calls  - publicDecrypt() via the relayer SDK
 *         5. Anyone calls on-chain   - finalizeResult() with cleartext + proof
 *         6. Contract calls          - FHE.checkSignatures() to verify proof
 *         7. Result stored and shown on frontend
 */
contract ConfidentialVoteDAO is ZamaEthereumConfig {

    // -------------------------------------------------------------------------
    // ENUMS
    // -------------------------------------------------------------------------

    enum ProposalStatus {
        Active,             // Voting is in progress
        DecryptionPending,  // Voting ended, off-chain can now decrypt
        ResultFinalized     // Result verified and stored on-chain
    }

    // -------------------------------------------------------------------------
    // STRUCTS
    // -------------------------------------------------------------------------

    struct Proposal {
        string title;
        string description;
        address proposer;
        uint256 startTime;
        uint256 endTime;
        euint64 encYesVotes;
        euint64 encNoVotes;
        uint64  clearYesVotes;
        uint64  clearNoVotes;
        ProposalStatus status;
        bool passed;
        uint256 totalVoters;
    }

    // -------------------------------------------------------------------------
    // STATE VARIABLES
    // -------------------------------------------------------------------------

    address public owner;
    uint256 public proposalCount;

    // Change to a shorter duration when testing e.g. 10 minutes
    uint256 public constant VOTING_DURATION = 3 days;
    uint256 public constant MIN_QUORUM = 1;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(address => bool) public members;

    // -------------------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------------------

    event MemberAdded(address indexed member);
    event MemberRemoved(address indexed member);
    event ProposalCreated(
        uint256 indexed proposalId,
        string title,
        address indexed proposer,
        uint256 endTime
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    event ResultDecryptable(
        uint256 indexed proposalId,
        bytes32 encYesHandle,
        bytes32 encNoHandle
    );
    event ResultFinalized(
        uint256 indexed proposalId,
        uint64 yesVotes,
        uint64 noVotes,
        bool passed
    );

    // -------------------------------------------------------------------------
    // ERRORS
    // -------------------------------------------------------------------------

    error NotOwner();
    error NotMember();
    error AlreadyMember();
    error NotAMember();
    error ProposalNotFound();
    error VotingNotActive();
    error VotingStillActive();
    error AlreadyVoted();
    error QuorumNotMet();
    error WrongStatus();

    // -------------------------------------------------------------------------
    // MODIFIERS
    // -------------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMember() {
        if (!members[msg.sender]) revert NotMember();
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        if (proposalId == 0 || proposalId > proposalCount) revert ProposalNotFound();
        _;
    }

    // -------------------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
        members[msg.sender] = true;
        emit MemberAdded(msg.sender);
    }

    // -------------------------------------------------------------------------
    // MEMBER MANAGEMENT
    // -------------------------------------------------------------------------

    /**
     * @notice Add a new DAO member. Only callable by the owner.
     * @param member The address to grant membership to
     */
    function addMember(address member) external onlyOwner {
        if (members[member]) revert AlreadyMember();
        members[member] = true;
        emit MemberAdded(member);
    }

    /**
     * @notice Remove a DAO member. Only callable by the owner.
     * @param member The address to revoke membership from
     */
    function removeMember(address member) external onlyOwner {
        if (!members[member]) revert NotAMember();
        members[member] = false;
        emit MemberRemoved(member);
    }

    /**
     * @notice Transfer contract ownership to a new address.
     * @param newOwner The address to transfer ownership to
     */
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // PROPOSAL CREATION
    // -------------------------------------------------------------------------

    /**
     * @notice Create a new governance proposal. Any member can create one.
     * @param title Short human-readable title stored publicly on-chain
     * @param description Full description of what this proposal changes
     * @return proposalId The ID assigned to the new proposal
     *
     * @dev Initializes two euint64 encrypted counters to zero.
     *      FHE.allowThis() grants the contract ACL permission to update them.
     */
    function createProposal(
        string calldata title,
        string calldata description
    ) external onlyMember returns (uint256 proposalId) {
        proposalCount++;
        proposalId = proposalCount;

        Proposal storage p = proposals[proposalId];
        p.title       = title;
        p.description = description;
        p.proposer    = msg.sender;
        p.startTime   = block.timestamp;
        p.endTime     = block.timestamp + VOTING_DURATION;
        p.status      = ProposalStatus.Active;

        // Initialize encrypted vote tallies to zero
        p.encYesVotes = FHE.asEuint64(0);
        p.encNoVotes  = FHE.asEuint64(0);

        // Grant this contract ACL permission to read and modify these handles
        FHE.allowThis(p.encYesVotes);
        FHE.allowThis(p.encNoVotes);

        emit ProposalCreated(proposalId, title, msg.sender, p.endTime);
    }

    // -------------------------------------------------------------------------
    // VOTING
    // -------------------------------------------------------------------------

    /**
     * @notice Cast an encrypted vote on an active proposal.
     * @param proposalId    The ID of the proposal to vote on
     * @param encryptedVote An encrypted boolean (true = yes, false = no)
     *                      encrypted client-side using the Zama FHE public key
     * @param inputProof    Zero-knowledge proof binding this ciphertext to
     *                      msg.sender and address(this)
     *
     * @dev How the encrypted tally works:
     *
     *      The voter submits an encrypted ebool. Nobody on-chain can read it.
     *
     *      FHE.select(vote, one, zero) works like a multiplexer on ciphertexts:
     *        if encrypted(vote) is true  -> returns encrypted(1)
     *        if encrypted(vote) is false -> returns encrypted(0)
     *      This comparison NEVER reveals the vote value.
     *
     *      We then add the result to the running encrypted tallies:
     *        encYesVotes += select(vote, 1, 0)  -- all stays encrypted
     *        encNoVotes  += select(vote, 0, 1)  -- all stays encrypted
     *
     *      The vote is permanently invisible on-chain.
     */
    function castVote(
        uint256 proposalId,
        externalEbool encryptedVote,
        bytes calldata inputProof
    ) external onlyMember proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.Active) revert WrongStatus();
        if (block.timestamp < p.startTime || block.timestamp > p.endTime) {
            revert VotingNotActive();
        }
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // Validate the external encrypted input using its ZK proof
        // Reverts automatically if the proof is invalid
        ebool vote = FHE.fromExternal(encryptedVote, inputProof);

        // Encrypted constants used in the tally logic
        euint64 one  = FHE.asEuint64(1);
        euint64 zero = FHE.asEuint64(0);

        // Conditionally increment yes or no — computed entirely on ciphertexts
        euint64 yesIncrement = FHE.select(vote, one, zero);
        euint64 noIncrement  = FHE.select(vote, zero, one);

        // Accumulate into the running encrypted totals
        p.encYesVotes = FHE.add(p.encYesVotes, yesIncrement);
        p.encNoVotes  = FHE.add(p.encNoVotes,  noIncrement);

        // Re-grant ACL permission after mutation (required by fhEVM after updates)
        FHE.allowThis(p.encYesVotes);
        FHE.allowThis(p.encNoVotes);

        // Record that this address voted (public: reveals THAT they voted, not HOW)
        _hasVoted[proposalId][msg.sender] = true;
        p.totalVoters++;

        emit VoteCast(proposalId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // STEP 1 OF RESULT REVEAL: Mark ciphertexts as publicly decryptable
    // -------------------------------------------------------------------------

    /**
     * @notice Mark the encrypted vote tallies as publicly decryptable.
     *         Call this after the voting period ends.
     * @param proposalId The proposal to open for decryption
     *
     * @dev This is Step 1 of the v0.9 self-relaying decryption flow.
     *
     *      FHE.makePubliclyDecryptable() sets the ACL flag on each ciphertext,
     *      permanently authorizing any off-chain entity to request decryption
     *      from the Zama KMS via the relayer SDK.
     *
     *      The emitted ResultDecryptable event contains the encrypted handles.
     *      The frontend reads these handles and passes them to publicDecrypt().
     *
     *      Off-chain client code (JavaScript, using relayer SDK):
     *
     *        const instance = await createInstance();
     *        const results = await instance.publicDecrypt([
     *            encYesHandle,
     *            encNoHandle
     *        ]);
     *        // Then call finalizeResult() with results
     */
    function markResultDecryptable(uint256 proposalId)
        external
        onlyMember
        proposalExists(proposalId)
    {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.Active) revert WrongStatus();
        if (block.timestamp <= p.endTime) revert VotingStillActive();
        if (p.totalVoters < MIN_QUORUM) revert QuorumNotMet();

        // Permanently authorize public decryption of both encrypted tallies
        FHE.makePubliclyDecryptable(p.encYesVotes);
        FHE.makePubliclyDecryptable(p.encNoVotes);

        p.status = ProposalStatus.DecryptionPending;

        // Emit handles so the frontend can retrieve them and pass to publicDecrypt()
        emit ResultDecryptable(
            proposalId,
            FHE.toBytes32(p.encYesVotes),
            FHE.toBytes32(p.encNoVotes)
        );
    }

    // -------------------------------------------------------------------------
    // STEP 2 OF RESULT REVEAL: Submit decrypted values and verify proof on-chain
    // -------------------------------------------------------------------------

    /**
     * @notice Finalize and store the decrypted vote result on-chain.
     *         Anyone can call this after obtaining the proof off-chain.
     * @param proposalId         The proposal being finalized
     * @param clearYesVotes      Decrypted yes vote count obtained from the relayer SDK
     * @param clearNoVotes       Decrypted no vote count obtained from the relayer SDK
     * @param publicDecryptProof Cryptographic proof from the Zama KMS confirming
     *                           these cleartext values are authentic
     *
     * @dev This is Step 2 of the v0.9 self-relaying flow.
     *
     *      The caller must first perform off-chain decryption using the relayer SDK:
     *
     *        Step A - get the handles from the ResultDecryptable event or
     *                 by calling getEncryptedHandles(proposalId)
     *
     *        Step B - off-chain JavaScript:
     *                   const instance = await createInstance();
     *                   const results = await instance.publicDecrypt([
     *                       encYesHandle,
     *                       encNoHandle
     *                   ]);
     *                   clearYesVotes = results.clearValues[encYesHandle]
     *                   clearNoVotes  = results.clearValues[encNoHandle]
     *                   proof         = results.decryptionProof
     *
     *        Step C - call this function with the values from Step B
     *
     *      On-chain verification:
     *        FHE.checkSignatures() verifies the proof was issued by the real
     *        Zama KMS and that the clear values match the original ciphertexts.
     *        If the proof is invalid or tampered with, the transaction reverts.
     *
     *      IMPORTANT - ORDER IS CRITICAL:
     *        The handles array and the abi.encode() call must use the same order.
     *        This contract always uses [encYesVotes, encNoVotes].
     *        The off-chain publicDecrypt() call must pass handles in the same order.
     */
    function finalizeResult(
        uint256 proposalId,
        uint64  clearYesVotes,
        uint64  clearNoVotes,
        bytes calldata publicDecryptProof
    ) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.DecryptionPending) revert WrongStatus();

        // Build handles array — ORDER MUST MATCH abi.encode order below
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(p.encYesVotes); // index 0 = yes
        handles[1] = FHE.toBytes32(p.encNoVotes);  // index 1 = no

        // ABI-encode the clear values in the SAME ORDER as handles above
        bytes memory abiClearValues = abi.encode(clearYesVotes, clearNoVotes);

        // Verify the proof — reverts if proof is invalid, forged, or order is wrong
        FHE.checkSignatures(handles, abiClearValues, publicDecryptProof);

        // Store the verified results
        p.clearYesVotes = clearYesVotes;
        p.clearNoVotes  = clearNoVotes;
        p.passed        = clearYesVotes > clearNoVotes;
        p.status        = ProposalStatus.ResultFinalized;

        emit ResultFinalized(proposalId, clearYesVotes, clearNoVotes, p.passed);
    }

    // -------------------------------------------------------------------------
    // VIEW FUNCTIONS
    // -------------------------------------------------------------------------

    /**
     * @notice Get all public metadata for a proposal.
     * @param proposalId The proposal to query
     */
    function getProposal(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            string memory title,
            string memory description,
            address proposer,
            uint256 startTime,
            uint256 endTime,
            ProposalStatus status,
            bool passed,
            uint64 clearYesVotes,
            uint64 clearNoVotes,
            uint256 totalVoters
        )
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.title,
            p.description,
            p.proposer,
            p.startTime,
            p.endTime,
            p.status,
            p.passed,
            p.clearYesVotes,
            p.clearNoVotes,
            p.totalVoters
        );
    }

    /**
     * @notice Get the encrypted ciphertext handles for a proposal's vote tallies.
     *         Use these handles to call publicDecrypt() via the relayer SDK.
     *         Only meaningful after markResultDecryptable() has been called.
     * @param proposalId The proposal to query
     */
    function getEncryptedHandles(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (bytes32 encYesHandle, bytes32 encNoHandle)
    {
        Proposal storage p = proposals[proposalId];
        return (
            FHE.toBytes32(p.encYesVotes),
            FHE.toBytes32(p.encNoVotes)
        );
    }

    /**
     * @notice Check whether an address has voted on a proposal.
     *         Returns true or false only — reveals that they voted, never how.
     * @param proposalId The proposal to check
     * @param voter      The address to check
     */
    function hasVoted(uint256 proposalId, address voter)
        external
        view
        returns (bool)
    {
        return _hasVoted[proposalId][voter];
    }

    /**
     * @notice Check whether voting is currently open for a proposal.
     * @param proposalId The proposal to check
     */
    function isVotingActive(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (bool)
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.status == ProposalStatus.Active &&
            block.timestamp >= p.startTime &&
            block.timestamp <= p.endTime
        );
    }
}
