pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-voting/contracts/Voting.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";


contract VotingReward is AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    // prettier-ignore
    bytes32 public constant CHANGE_MIN_SECONDS_THREESOLD = keccak256("CHANGE_MIN_SECONDS_THREESOLD");
    // prettier-ignore
    bytes32 public constant CHANGE_VAULT_ROLE = keccak256("CHANGE_VAULT_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VOTING_ROLE = keccak256("CHANGE_VOTING_ROLE");

    // prettier-ignore
    string private constant ERROR_ADDRESS_NOT_CONTRACT = "VOTING_REWARD_ADDRESS_NOT_CONTRACT";
    // prettier-ignore
    string private constant ERROR_MIN_SECONDS_THREESHOLD_NOT_ZERO = "VOTING_REWARD_MIN_SECONDS_THREESHOLD_NOT_ZERO";
    // prettier-ignore
    string private constant ERROR_VAULT_INSUFFICENT_TOKENS = "VOTING_REWARD_VAULT_INSUFFICENT_TOKENS";
    // prettier-ignore
    string private constant ERROR_VOTING_NO_VOTES = "VOTING_REWARD_VOTING_NO_VOTES";
    // prettier-ignore
    string private constant ERROR_SENDER_NOT_VOTED = "VOTING_REWARD_NOT_VOTED";
    // prettier-ignore
    string private constant ERROR_TOO_MUCH_MISSING_VOTES = "VOTING_REWARD_TOO_MUCH_MISSING_VOTES";
    // prettier-ignore
    string private constant ERROR_EPOCH_NOT_REACHED = "VOTING_REWARD_EPOCH_NOT_REACHED";

    Vault public baseVault;
    Vault public rewardsVault;
    Voting public voting;

    address public rewardsToken;
    uint64 public epoch;
    uint64 private deployDate;

    mapping(address => uint64) public lastDateClaimedRewards;
    mapping(address => uint64) public addressDateLastDistributedReward;

    event EpochChanged(uint64 epoch);
    event BaseVaultChanged(address baseVault);
    event RewardVaultChanged(address rewardsVault);
    event VotingChanged(address voting);
    event RewardDistributed(address beneficiary, uint256 amount);

    /**
     * @notice Initialize VotingReward app contract
     * @param _baseVault Vault address from which token are taken
     * @param _rewardsVault Vault address to which token are put
     * @param _voting Voting address
     * @param _rewardsToken Accepted token address
     * @param _epoch number of seconds minimun to have access to voting rewards
     */
    function initialize(
        address _baseVault,
        address _rewardsVault,
        address _voting,
        address _rewardsToken,
        uint64 _epoch
    ) external onlyInit {
        require(isContract(_baseVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsToken), ERROR_ADDRESS_NOT_CONTRACT);

        baseVault = Vault(_baseVault);
        rewardsVault = Vault(_rewardsVault);
        voting = Voting(_voting);
        rewardsToken = _rewardsToken;
        epoch = _epoch;
        deployDate = getTimestamp64();

        initialized();
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     * @param _beneficiary address to which the deposit will be transferred if successful
     */
    function claimReward(address _beneficiary) external {
        uint256 votesLength = voting.votesLength();
        require(votesLength > 0, ERROR_VOTING_NO_VOTES);

        uint64 timestamp = getTimestamp64();

        uint64 lastDateClaimedReward = 0;
        if (lastDateClaimedRewards[_beneficiary] != 0) {
            lastDateClaimedReward = lastDateClaimedRewards[_beneficiary];
        } else {
            lastDateClaimedReward = deployDate;
        }

        // must be passed at least one epoch before requesting another reward
        require(
            timestamp - lastDateClaimedReward >= epoch,
            ERROR_EPOCH_NOT_REACHED
        );

        // missingVotesThreeshold is (now - lastDateClaimedReward) / epoch
        // where lastDateClaimedReward is equal to deployDate if a _beneficiary
        // never claimed a reward in order to be able to catch all previous proposals
        uint64 missingVotesThreeshold = timestamp
            .sub(lastDateClaimedReward)
            .div(epoch);

        uint64 recentVote = 0;
        uint256 missingVotes = 0;
        // TODO: calculate reward correctly
        uint256 reward = 10;

        for (uint256 voteId = 0; voteId < votesLength; voteId++) {
            uint64 startDate;
            (, , startDate, , , , , , , ) = voting.getVote(voteId);

            // if a vote is within the threeshold
            if (startDate >= lastDateClaimedReward) {
                Voting.VoterState state = voting.getVoterState(
                    voteId,
                    _beneficiary
                );

                // if _beneficiary has voted
                if (state != Voting.VoterState.Absent) {
                    if (startDate > recentVote) {
                        recentVote = startDate;
                    }
                } else {
                    missingVotes = missingVotes.add(1);
                }

                // avoid cycles when there is more than missingVotesThreeshold missing votes
                require(
                    missingVotes <= missingVotesThreeshold,
                    ERROR_TOO_MUCH_MISSING_VOTES
                );
            }
        }

        // be sure that baseVault contains at least this reward
        require(
            ERC20(rewardsToken).balanceOf(baseVault) >= reward,
            ERROR_VAULT_INSUFFICENT_TOKENS
        );

        lastDateClaimedRewards[_beneficiary] = recentVote;

        // TODO: send reward to vaultReward

        emit RewardDistributed(_beneficiary, reward);
    }

    /**
     * @notice Change minimum number of seconds to have access to voting rewards
     * @param _epoch number of seconds minimun to have access to voting rewards
     */
    function changeEpoch(uint64 _epoch)
        external
        auth(CHANGE_MIN_SECONDS_THREESOLD)
    {
        require(_epoch > 0, ERROR_MIN_SECONDS_THREESHOLD_NOT_ZERO);
        epoch = _epoch;

        emit EpochChanged(_epoch);
    }

    /**
     * @notice Change Base Vault
     * @param _baseVault new base vault address
     */
    function changeBaseVault(address _baseVault)
        external
        auth(CHANGE_VAULT_ROLE)
    {
        require(isContract(_baseVault), ERROR_ADDRESS_NOT_CONTRACT);
        baseVault = Vault(_baseVault);

        emit BaseVaultChanged(_baseVault);
    }

    /**
     * @notice Change Reward Vault
     * @param _rewardsVault new reward vault address
     */
    function changeRewardVault(address _rewardsVault)
        external
        auth(CHANGE_VAULT_ROLE)
    {
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        rewardsVault = Vault(_rewardsVault);

        emit RewardVaultChanged(_rewardsVault);
    }

    /**
     * @notice Change Voting
     * @param _voting new voting address
     */
    function changeVoting(address _voting) external auth(CHANGE_VOTING_ROLE) {
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        voting = Voting(_voting);

        emit VotingChanged(_voting);
    }
}
