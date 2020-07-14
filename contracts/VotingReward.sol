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
    string private constant ERROR_VAULT_NO_VOTES = "VOTING_REWARD_VAULT_NO_VOTES";
    // prettier-ignore
    string private constant ERROR_TOO_MUCH_MISSING_VOTES = "VOTING_REWARD_TOO_MUCH_MISSING_VOTES";

    Vault public vault;
    Voting public voting;

    address public rewardToken;
    uint64 public minSecondsThreeshold;

    mapping(address => uint64) public addressDateLastVote;

    event MinSecondsThreesholdChanged(uint64 minSecondsThreeshold);
    event VaultChanged(address vault);
    event VotingChanged(address voting);
    event RewardDistributed(address beneficiary, uint256 amount);

    /**
     * @notice Initialize VotingReward app contract
     * @param _vault Vault address
     * @param _voting Voting address
     * @param _rewardToken Accepted token address
     * @param _minSecondsThreeshold number of seconds minimun to have access to voting rewards
     */
    function initialize(
        address _vault,
        address _voting,
        address _rewardToken,
        uint64 _minSecondsThreeshold
    ) external onlyInit {
        require(isContract(_vault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardToken), ERROR_ADDRESS_NOT_CONTRACT);

        vault = Vault(_vault);
        voting = Voting(_voting);
        rewardToken = _rewardToken;
        minSecondsThreeshold = _minSecondsThreeshold;

        initialized();
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     */
    function claimRewards() external view {
        uint256 votesLength = voting.votesLength();
        require(votesLength > 0, ERROR_VAULT_NO_VOTES);

        // threeshold is (getTimestamp64() - dateLastProposal) / minSecondsThreeshold
        // where dateLastProposal is equal to getTimestamp64() if a msg.sender
        // never claimed a reward in order to be able to catch all previous proposals
        uint64 dateLastProposal = getTimestamp64();
        if (addressDateLastVote[msg.sender] != 0) {
            dateLastProposal = addressDateLastVote[msg.sender];
        }

        uint64 timeThreeshold = getTimestamp64().sub(dateLastProposal);
        uint64 missVotesThreeshold = timeThreeshold.div(minSecondsThreeshold);
        uint64 recentVote = 0;
        uint256 missVotes = 0;
        // TODO: calculate reward correctly
        uint256 reward = 10;

        for (uint256 voteId; voteId < votesLength; voteId++) {
            uint64 startDate;
            (, , startDate, , , , , , , ) = voting.getVote(voteId);

            // if a vote is within the threeshold
            if (startDate >= timeThreeshold) {
                Voting.VoterState state = voting.getVoterState(
                    voteId,
                    msg.sender
                );

                // if msg.sender has voted
                if (state != Voting.VoterState.Absent) {
                    if (startDate > recentVote) {
                        recentVote = startDate;
                    }
                } else {
                    missVotes = missVotes.add(1);
                }

                // avoid cycles when there is more than missVotesThreeshold missing votes
                require(
                    missVotes <= missVotesThreeshold,
                    ERROR_TOO_MUCH_MISSING_VOTES
                );
            }
        }

        // be sure that vault contains at least this reward
        require(
            ERC20(rewardToken).balanceOf(vault) >= reward,
            ERROR_VAULT_INSUFFICENT_TOKENS
        );

        addressDateLastVote[msg.sender] = recentVote;

        emit RewardDistributed(msg.sender, reward);
    }

    /**
     * @notice Change minimum number of seconds to have access to voting rewards
     * @param _minSecondsThreeshold number of seconds minimun to have access to voting rewards
     */
    function changeMinSecondsThreeshold(uint64 _minSecondsThreeshold)
        external
        auth(CHANGE_MIN_SECONDS_THREESOLD)
    {
        require(
            _minSecondsThreeshold > 0,
            ERROR_MIN_SECONDS_THREESHOLD_NOT_ZERO
        );
        minSecondsThreeshold = _minSecondsThreeshold;

        emit MinSecondsThreesholdChanged(_minSecondsThreeshold);
    }

    /**
     * @notice Change Vault
     * @param _vault new vault address
     */
    function changeVault(address _vault) external auth(CHANGE_VAULT_ROLE) {
        require(isContract(_vault), ERROR_ADDRESS_NOT_CONTRACT);
        vault = Vault(_vault);

        emit VaultChanged(_vault);
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
