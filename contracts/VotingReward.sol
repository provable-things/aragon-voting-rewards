pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-voting/contracts/Voting.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";


contract VotingReward is AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    // prettier-ignore
    bytes32 public constant CHANGE_EPOCH_ROLE = keccak256("CHANGE_EPOCH_ROLE");
    // prettier-ignore
    bytes32 public constant OPEN_CLAIM_EPOCH_ROLE = keccak256("OPEN_CLAIM_EPOCH_ROLE");
    // prettier-ignore
    bytes32 public constant CLOSE_EPOCH_ROLE = keccak256("CLOSE_EPOCH_ROLE");
    // prettier-ignore
    bytes32 public constant COLLECT_REWARDS_ROLE = keccak256("COLLECT_REWARDS_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_PERCENTAGE_REWARD_ROLE = keccak256("CHANGE_PERCENTAGE_REWARD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VAULT_ROLE = keccak256("CHANGE_VAULT_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VOTING_ROLE = keccak256("CHANGE_VOTING_ROLE");

    // prettier-ignore
    string private constant ERROR_ADDRESS_NOT_CONTRACT = "VOTING_REWARD_ADDRESS_NOT_CONTRACT";
    // prettier-ignore
    string private constant ERROR_EPOCH_NOT_ZERO = "VOTING_EPOCH_NOT_ZERO";
    // prettier-ignore
    string private constant ERROR_VAULT_INSUFFICENT_TOKENS = "VOTING_REWARD_VAULT_INSUFFICENT_TOKENS";
    // prettier-ignore
    string private constant ERROR_VOTING_NO_VOTES = "VOTING_REWARD_VOTING_NO_VOTES";
    // prettier-ignore
    string private constant ERROR_SENDER_NOT_VOTED = "VOTING_REWARD_NOT_VOTED";
    // prettier-ignore
    string private constant ERROR_TOO_MUCH_MISSING_VOTES = "VOTING_REWARD_TOO_MUCH_MISSING_VOTES";
    // prettier-ignore
    string private constant ERROR_EPOCH = "VOTING_REWARD_ERROR_EPOCH";
    // prettier-ignore
    string private constant ERROR_EPOCH_WRONG_VALUE = "VOTING_REWARD_ERROR_EPOCH_WRONG_VALUE";
    // prettier-ignore
    string private constant ERROR_PERCENTAGE_REWARD = "VOTING_REWARD_PERCENTAGE_REWARD";
    // prettier-ignore
    string private constant ERROR_EPOCH_CLAIM_NOT_OPENED = "VOTING_REWARD_CLAIM_NOT_OPENED";
    // prettier-ignore
    string private constant ERROR_EPOCH_CLAIM_ALREADY_OPENED = "ERROR_EPOCH_CLAIM_ALREADY_OPENED";

    /*enum LockState {Unwithdrawn, Withdrawn}

    struct Lock {
        uint256 amount;
        LockState state;
        uint64 lockDate;
    }*/

    Vault public baseVault;
    Vault public rewardsVault;
    Voting public voting;

    address public rewardsToken;
    uint256 public percentageReward;

    uint64 public epochDuration;
    uint64 public currentEpoch;
    uint64 private deployDate;
    uint64 public claimStart;
    uint64 public lastClaimDate;

    bool public isClaimOpened;

    mapping(address => uint64) public lastDateClaimedRewards;

    event BaseVaultChanged(address baseVault);
    event RewardVaultChanged(address rewardsVault);
    event VotingChanged(address voting);
    event PercentageRewardChanged(uint256 percentageReward);
    event RewardDistributed(address beneficiary, uint256 amount);
    event EpochDurationChanged(uint64 epoch);
    event ClaimEpochOpened(uint64 start, uint64 end);
    event ClaimEpochClosed(uint64 date);

    /**
     * @notice Initialize VotingReward app contract
     * @param _baseVault Vault address from which token are taken
     * @param _rewardsVault Vault address to which token are put
     * @param _voting Voting address
     * @param _rewardsToken Accepted token address
     * @param _epochDuration number of seconds minimun to have access to voting rewards
     * @param _percentageReward percentage of a reward
     */
    function initialize(
        address _baseVault,
        address _rewardsVault,
        address _voting,
        address _rewardsToken,
        uint64 _epochDuration,
        uint256 _percentageReward
    ) external onlyInit {
        require(isContract(_baseVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsToken), ERROR_ADDRESS_NOT_CONTRACT);
        require(
            percentageReward >= 0 && _percentageReward <= 100,
            ERROR_PERCENTAGE_REWARD
        );

        baseVault = Vault(_baseVault);
        rewardsVault = Vault(_rewardsVault);
        voting = Voting(_voting);
        rewardsToken = _rewardsToken;
        epochDuration = _epochDuration;
        percentageReward = _percentageReward;

        deployDate = getTimestamp64();
        lastClaimDate = getTimestamp64();
        currentEpoch = 0;

        initialized();
    }

    /**
     * @notice Open the claim for the current epoch from _claimStart
     * @param _claimStart date from which starts to looking for rewards
     */
    function openClaimForEpoch(uint64 _claimStart)
        external
        auth(OPEN_CLAIM_EPOCH_ROLE)
    {
        require(!isClaimOpened, ERROR_EPOCH_CLAIM_ALREADY_OPENED);
        require(_claimStart >= lastClaimDate, ERROR_EPOCH);

        claimStart = _claimStart;
        isClaimOpened = true;

        emit ClaimEpochOpened(_claimStart, _claimStart + epochDuration);
    }

    /**
     * @notice close claim for current epoch if it's opened
     */
    function closeClaimForCurrentEpoch() external auth(OPEN_CLAIM_EPOCH_ROLE) {
        isClaimOpened = false;
        currentEpoch = currentEpoch.add(1);
        lastClaimDate = getTimestamp64();
        emit ClaimEpochClosed(getTimestamp64());
    }

    /**
     * @notice collect rewards for a list of address
     * @param _beneficiaries address that are looking for reward
     */
    function collectRewards(address[] _beneficiaries)
        external
        auth(COLLECT_REWARDS_ROLE)
    {
        require(voting.votesLength() > 0, ERROR_VOTING_NO_VOTES);
        require(isClaimOpened, ERROR_EPOCH_CLAIM_NOT_OPENED);

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            collectForAddress(_beneficiaries[i]);
        }
    }

    /**
     * @notice Change minimum number of seconds to claim voting rewards
     * @param _epochDuration number of seconds minimun to claim access to voting rewards
     */
    function changeEpoch(uint64 _epochDuration)
        external
        auth(CHANGE_EPOCH_ROLE)
    {
        require(_epochDuration > 0, ERROR_EPOCH_NOT_ZERO);
        epochDuration = _epochDuration;

        emit EpochDurationChanged(_epochDuration);
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

    /**
     * @notice Change percentage reward
     * @param _percentageReward new percentage
     */
    function changePercentageReward(uint256 _percentageReward)
        external
        auth(CHANGE_PERCENTAGE_REWARD_ROLE)
    {
        require(
            percentageReward >= 0 && _percentageReward <= 100,
            ERROR_PERCENTAGE_REWARD
        );
        percentageReward = _percentageReward;

        emit PercentageRewardChanged(percentageReward);
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     * @param _beneficiary address to which the deposit will be transferred if successful
     */
    function collectForAddress(address _beneficiary)
        public
        auth(COLLECT_REWARDS_ROLE)
    {
        //require(isClaimOpened, ERROR_EPOCH_CLAIM_NOT_OPENED);

        uint64 lastDateClaimedReward = 0;
        if (lastDateClaimedRewards[_beneficiary] != 0) {
            lastDateClaimedReward = lastDateClaimedRewards[_beneficiary];
        } else {
            lastDateClaimedReward = deployDate;
        }

        // avoid double collecting for the same epoch
        require(
            claimStart.add(epochDuration) > lastDateClaimedReward,
            ERROR_EPOCH
        );

        uint64 claimEnd = claimStart.add(epochDuration);
        uint256 incrementalBalance = _calculateIncrementalBalance(
            _beneficiary,
            claimStart,
            claimEnd,
            1
        );

        uint256 reward = _calculatePercentage(
            incrementalBalance,
            percentageReward
        );

        // TODO: understand if it's better to set the date
        // equal to now(timestamp) or the most recent vote date
        lastDateClaimedRewards[_beneficiary] = getTimestamp64();

        // TODO: lock tokens for a given time

        baseVault.transfer(rewardsToken, rewardsVault, reward);
        emit RewardDistributed(_beneficiary, reward);
    }

    /**
     * @notice Return the reward for _beneficiary and the range in which the reward has been calculated
     * @param _beneficiary beneficiary
     * @param _from date from wich starting looking for votes
     * @param _to   date to wich stopping looking for votes
     * @param _missingVotesThreeshold number of vote to which is possible to don't vote
     */
    function _calculateIncrementalBalance(
        address _beneficiary,
        uint64 _from,
        uint64 _to,
        uint256 _missingVotesThreeshold
    ) internal view returns (uint256 balance) {
        uint256 missingVotes = 0;
        MiniMeToken token = MiniMeToken(voting.token());

        for (uint256 voteId = 0; voteId < voting.votesLength(); voteId++) {
            uint64 startDate;
            uint64 snapshotBlock;
            (, , startDate, snapshotBlock, , , , , , ) = voting.getVote(voteId);

            if (startDate >= _from && startDate <= _to) {
                Voting.VoterState state = voting.getVoterState(
                    voteId,
                    _beneficiary
                );

                if (state == Voting.VoterState.Absent) {
                    missingVotes = missingVotes.add(1);
                } else {
                    balance = balance.add(
                        token.balanceOfAt(_beneficiary, snapshotBlock)
                    );
                }

                require(
                    missingVotes <= _missingVotesThreeshold,
                    ERROR_TOO_MUCH_MISSING_VOTES
                );
            }
        }

        return balance;
    }

    /**
     * @dev Calculates a percentage
     */
    function _calculatePercentage(uint256 _value, uint256 _pct)
        internal
        pure
        returns (uint256)
    {
        return _value.mul(_pct).div(100);
    }
}
