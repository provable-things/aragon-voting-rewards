pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@1hive/apps-dandelion-voting/contracts/DandelionVoting.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";


contract VotingRewards is AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    // prettier-ignore
    bytes32 public constant CHANGE_EPOCH_DURATION_ROLE = keccak256("CHANGE_EPOCH_DURATION_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_REWARD_TOKEN_ROLE = keccak256("CHANGE_REWARD_TOKEN_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_MISSING_VOTES_THRESHOLD_ROLE = keccak256("CHANGE_MISSING_VOTES_THRESHOLD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_LOCK_TIME_ROLE = keccak256("CHANGE_LOCK_TIME_ROLE");
    // prettier-ignore
    bytes32 public constant OPEN_REWARD_DISTRIBUTION_ROLE = keccak256("OPEN_REWARD_DISTRIBUTION_ROLE");
    // prettier-ignore
    bytes32 public constant CLOSE_REWARD_DISTRIBUTION_ROLE = keccak256("CLOSE_REWARD_DISTRIBUTION_ROLE");
    // prettier-ignore
    bytes32 public constant DISTRIBUTE_REWARD_ROLE = keccak256("DISTRIBUTE_REWARD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_PERCENTAGE_REWARD_ROLE = keccak256("CHANGE_PERCENTAGE_REWARD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VAULT_ROLE = keccak256("CHANGE_VAULT_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_VOTING_ROLE = keccak256("CHANGE_VOTING_ROLE");

    uint64 public constant PCT_BASE = 10**18; // 0% = 0; 1% = 10^16; 100% = 10^18

    // prettier-ignore
    string private constant ERROR_ADDRESS_NOT_CONTRACT = "VOTING_REWARD_ADDRESS_NOT_CONTRACT";
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
    string private constant ERROR_EPOCH_REWARD_DISTRIBUTION_NOT_OPENED = "VOTING_REWARD_EPOCH_REWARD_DISTRIBUTION_NOT_OPENED";
    // prettier-ignore
    string private constant ERROR_EPOCH_REWARD_DISTRIBUTION_ALREADY_OPENED = "VOTING_REWARD_EPOCH_REWARD_DISTRIBUTION_ALREADY_OPENED";
    // prettier-ignore
    string private constant ERROR_WRONG_VALUE = "VOTING_REWARD_WRONG_VALUE";
    // prettier-ignore
    string private constant ERROR_NO_REWARDS = "VOTING_REWARD_NO_REWARDS";

    enum RewardState {Unlocked, Withdrawn}

    struct Reward {
        uint256 amount;
        RewardState state;
        uint64 lockBlock;
        uint64 lockTime;
    }

    Vault public baseVault;
    Vault public rewardsVault;
    DandelionVoting public dandelionVoting;

    address public rewardToken;
    uint256 public percentageReward;
    uint256 public missingVotesThreshold;

    uint64 public epochDuration;
    uint64 public currentEpoch;
    uint64 public startBlockNumberOfCurrentEpoch;
    uint64 public lockTime;
    uint64 public lastRewardDistributionBlock;
    uint64 private deployBlock;

    bool public isDistributionOpen;

    mapping(address => uint64) private previousRewardDistributionBlockNumber;
    mapping(address => Reward[]) public addressRewards;

    event BaseVaultChanged(address baseVault);
    event RewardsVaultChanged(address rewardsVault);
    event DandelionVotingChanged(address dandelionVoting);
    event PercentageRewardChanged(uint256 percentageReward);
    event RewardDistributed(
        address beneficiary,
        uint256 amount,
        uint64 lockTime
    );
    event RewardCollected(address beneficiary, uint256 amount);
    event EpochDurationChanged(uint64 epochDuration);
    event MissingVoteThresholdChanged(uint256 missingVotesThreshold);
    event LockTimeChanged(uint64 lockTime);
    event RewardDistributionEpochOpened(uint64 startBlock, uint64 endBlock);
    event RewardDistributionEpochClosed(uint64 rewardDistributionBlock);
    event RewardTokenChanged(address rewardToken);

    /**
     * @notice Initialize VotingRewards app contract
     * @param _baseVault Vault address from which token are taken
     * @param _rewardsVault Vault address to which token are put
     * @param _dandelionVoting DandelionVoting address
     * @param _rewardToken Accepted token address
     * @param _epochDuration number of blocks for which an epoch is opened
     * @param _percentageReward percentage of a reward expressed as a number between 10^16 and 10^18
     * @param _lockTime number of blocks for which token will be locked after colleting reward
     * @param _missingVotesThreshold number of missing votes allowed in an epoch
     */
    function initialize(
        address _baseVault,
        address _rewardsVault,
        address _dandelionVoting,
        address _rewardToken,
        uint64 _epochDuration,
        uint256 _percentageReward,
        uint64 _lockTime,
        uint256 _missingVotesThreshold
    ) external onlyInit {
        require(isContract(_baseVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_dandelionVoting), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardToken), ERROR_ADDRESS_NOT_CONTRACT);
        require(_percentageReward <= PCT_BASE, ERROR_PERCENTAGE_REWARD);
        require(_lockTime >= 0, ERROR_WRONG_VALUE);
        require(_missingVotesThreshold >= 0, ERROR_WRONG_VALUE);

        baseVault = Vault(_baseVault);
        rewardsVault = Vault(_rewardsVault);
        dandelionVoting = DandelionVoting(_dandelionVoting);
        rewardToken = _rewardToken;
        epochDuration = _epochDuration;
        percentageReward = _percentageReward;
        missingVotesThreshold = _missingVotesThreshold;
        lockTime = _lockTime;

        deployBlock = getBlockNumber64();
        lastRewardDistributionBlock = getBlockNumber64();
        currentEpoch = 0;

        initialized();
    }

    /**
     * @notice Open the distribution for the current epoch from _fromBlock
     * @param _fromBlock block from which starting to look for rewards
     */
    function openRewardDistributionForEpoch(uint64 _fromBlock)
        external
        auth(OPEN_REWARD_DISTRIBUTION_ROLE)
    {
        require(
            !isDistributionOpen,
            ERROR_EPOCH_REWARD_DISTRIBUTION_ALREADY_OPENED
        );
        require(_fromBlock > lastRewardDistributionBlock, ERROR_EPOCH);
        require(
            getBlockNumber64() - lastRewardDistributionBlock > epochDuration,
            ERROR_EPOCH
        );

        startBlockNumberOfCurrentEpoch = _fromBlock;
        isDistributionOpen = true;

        emit RewardDistributionEpochOpened(
            _fromBlock,
            _fromBlock + epochDuration
        );
    }

    /**
     * @notice close distribution for thee current epoch if it's opened and starts a new one
     */
    function closeRewardDistributionForCurrentEpoch()
        external
        auth(CLOSE_REWARD_DISTRIBUTION_ROLE)
    {
        require(
            isDistributionOpen == true,
            ERROR_EPOCH_REWARD_DISTRIBUTION_NOT_OPENED
        );
        isDistributionOpen = false;
        currentEpoch = currentEpoch.add(1);
        lastRewardDistributionBlock = getBlockNumber64();
        emit RewardDistributionEpochClosed(lastRewardDistributionBlock);
    }

    /**
     * @notice distribute rewards for a list of address. Tokens are locked for lockTime in rewardsVault
     * @param _beneficiaries address that are looking for reward
     * @dev this function should be called from outside each _epochDuration seconds
     */
    function distributeRewardsToMany(address[] _beneficiaries)
        external
        auth(DISTRIBUTE_REWARD_ROLE)
    {
        require(dandelionVoting.votesLength() > 0, ERROR_VOTING_NO_VOTES);
        require(isDistributionOpen, ERROR_EPOCH_REWARD_DISTRIBUTION_NOT_OPENED);

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            distributeRewardsTo(_beneficiaries[i]);
        }
    }

    /**
     * @notice collect rewards for a list of address
     *         if lockTime is passed since when tokens have been distributed
     * @param _beneficiaries addresses that should be fund with rewards
     */
    function collectRewardsForMany(address[] _beneficiaries) external {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            collectRewardsFor(_beneficiaries[i]);
        }
    }

    /**
     * @notice Change minimum number of seconds to claim dandelionVoting rewards
     * @param _epochDuration number of seconds minimum to claim access to dandelionVoting rewards
     */
    function changeEpochDuration(uint64 _epochDuration)
        external
        auth(CHANGE_EPOCH_DURATION_ROLE)
    {
        require(_epochDuration > 0, ERROR_WRONG_VALUE);
        epochDuration = _epochDuration;

        emit EpochDurationChanged(_epochDuration);
    }

    /**
     * @notice Change minimum number of missing votes allowed
     * @param _missingVotesThreshold number of seconds minimum to claim access to voting rewards
     */
    function changeMissingVotesThreshold(uint256 _missingVotesThreshold)
        external
        auth(CHANGE_MISSING_VOTES_THRESHOLD_ROLE)
    {
        require(_missingVotesThreshold >= 0, ERROR_WRONG_VALUE);
        missingVotesThreshold = _missingVotesThreshold;

        emit MissingVoteThresholdChanged(_missingVotesThreshold);
    }

    /**
     * @notice Change minimum number of missing votes allowed
     * @param _lockTime number of seconds for wich tokens will be locked after distributing reward
     */
    function changeLockTime(uint64 _lockTime)
        external
        auth(CHANGE_LOCK_TIME_ROLE)
    {
        lockTime = _lockTime;

        emit LockTimeChanged(_lockTime);
    }

    /**
     * @notice Change Base Vault
     * @param _baseVault new base vault address
     */
    function changeBaseVaultContractAddress(address _baseVault)
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
    function changeRewardsVaultContractAddress(address _rewardsVault)
        external
        auth(CHANGE_VAULT_ROLE)
    {
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        rewardsVault = Vault(_rewardsVault);

        emit RewardsVaultChanged(_rewardsVault);
    }

    /**
     * @notice Change Dandelion Voting contract address
     * @param _dandelionVoting new dandelionVoting address
     */
    function changeDandelionVotingContractAddress(address _dandelionVoting)
        external
        auth(CHANGE_VOTING_ROLE)
    {
        require(isContract(_dandelionVoting), ERROR_ADDRESS_NOT_CONTRACT);
        dandelionVoting = DandelionVoting(_dandelionVoting);

        emit DandelionVotingChanged(_dandelionVoting);
    }

    /**
     * @notice Change percentage reward
     * @param _percentageReward new percentage
     * @dev PCT_BASE is the maximun allowed percentage
     */
    function changePercentageReward(uint256 _percentageReward)
        external
        auth(CHANGE_PERCENTAGE_REWARD_ROLE)
    {
        require(_percentageReward <= PCT_BASE, ERROR_PERCENTAGE_REWARD);
        percentageReward = _percentageReward;

        emit PercentageRewardChanged(percentageReward);
    }

    /**
     * @notice Change rewards token
     * @param _rewardToken new percentage
     */
    function changeRewardTokenContractAddress(address _rewardToken)
        external
        auth(CHANGE_PERCENTAGE_REWARD_ROLE)
    {
        require(isContract(_rewardToken), ERROR_ADDRESS_NOT_CONTRACT);
        rewardToken = _rewardToken;

        emit RewardTokenChanged(rewardToken);
    }

    /**
     * @notice Returns all rewards given an address
     * @param _beneficiary address of which we want to get all rewards
     */
    function getRewardsInfo(address _beneficiary)
        external
        view
        returns (Reward[])
    {
        Reward[] rewards = addressRewards[_beneficiary];
        return rewards;
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     * @param _beneficiary address to which the deposit will be transferred if successful
     * @dev baseVault should have TRANSFER_ROLE permission
     */
    function distributeRewardsTo(address _beneficiary)
        public
        auth(DISTRIBUTE_REWARD_ROLE)
    {
        require(isDistributionOpen, ERROR_EPOCH_REWARD_DISTRIBUTION_NOT_OPENED);

        uint64 lastBlockDistributedReward = 0;
        if (previousRewardDistributionBlockNumber[_beneficiary] != 0) {
            lastBlockDistributedReward = previousRewardDistributionBlockNumber[_beneficiary];
        } else {
            lastBlockDistributedReward = deployBlock;
        }

        // avoid double collecting for the same epoch
        uint64 claimEnd = startBlockNumberOfCurrentEpoch.add(epochDuration);
        require(claimEnd > lastBlockDistributedReward, ERROR_EPOCH);

        uint256 rewardAmount = _calculateReward(
            _beneficiary,
            startBlockNumberOfCurrentEpoch,
            claimEnd,
            missingVotesThreshold
        );

        uint64 currentBlockNumber = getBlockNumber64();
        previousRewardDistributionBlockNumber[_beneficiary] = currentBlockNumber;

        addressRewards[_beneficiary].push(
            Reward(
                rewardAmount,
                RewardState.Unlocked,
                currentBlockNumber,
                lockTime
            )
        );

        baseVault.transfer(rewardToken, rewardsVault, rewardAmount);
        emit RewardDistributed(_beneficiary, rewardAmount, lockTime);
    }

    /**
     * @notice collect rewards for an address if lockTime is passed since when tokens have been distributed
     * @param _beneficiary address that should be fund with rewards
     * @dev rewardsVault should have TRANSFER_ROLE permission
     */
    function collectRewardsFor(address _beneficiary) public {
        uint64 timestamp = getBlockNumber64();
        // prettier-ignore
        Reward[] storage rewards = addressRewards[_beneficiary];

        require(rewards.length > 0, ERROR_NO_REWARDS);

        uint256 collectedRewards = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (
                timestamp - rewards[i].lockBlock > rewards[i].lockTime &&
                rewards[i].state != RewardState.Withdrawn
            ) {
                rewards[i].state = RewardState.Withdrawn;
                rewardsVault.transfer(
                    rewardToken,
                    _beneficiary,
                    rewards[i].amount
                );
                collectedRewards = collectedRewards.add(1);

                emit RewardCollected(_beneficiary, rewards[i].amount);
            }
        }

        require(collectedRewards >= 1, ERROR_NO_REWARDS);
    }

    /**
     * @notice Reward is calculated as the minimum balance between the
     *         end of an epoch (now) and the balance at the first
     *         vote in an epoch (in percentage) for each vote happened within the epoch
     * @param _beneficiary beneficiary
     * @param _from block from wich starting looking for votes
     * @param _to   block to wich stopping looking for votes
     * @param _missingVotesThreshold number of vote to which is possible to don't vote
     */
    function _calculateReward(
        address _beneficiary,
        uint64 _from,
        uint64 _to,
        uint256 _missingVotesThreshold
    ) internal view returns (uint256 balance) {
        MiniMeToken token = MiniMeToken(dandelionVoting.token());

        uint256 missingVotes = 0;
        uint256 minimunBalance = token.balanceOfAt(
            _beneficiary,
            getBlockNumber64()
        );

        // voteId starts from 1 in DandelionVoting
        for (
            uint256 voteId = dandelionVoting.votesLength();
            voteId > 1;
            voteId--
        ) {
            uint64 startBlock;
            (, , startBlock, , , , , , , , ) = dandelionVoting.getVote(
                voteId.sub(1)
            );

            if (startBlock >= _from && startBlock <= _to) {
                DandelionVoting.VoterState state = dandelionVoting
                    .getVoterState(voteId.sub(1), _beneficiary);

                if (state == DandelionVoting.VoterState.Absent) {
                    missingVotes = missingVotes.add(1);
                }

                require(
                    missingVotes <= _missingVotesThreshold,
                    ERROR_TOO_MUCH_MISSING_VOTES
                );

                uint256 balanceAtVote = token.balanceOfAt(
                    _beneficiary,
                    startBlock
                );
                if (balanceAtVote < minimunBalance) {
                    minimunBalance = balanceAtVote;
                }
            }

            // avoid "out of epoch" cycles
            if (startBlock < _from) break;
        }

        return minimunBalance.mul(percentageReward).div(PCT_BASE);
    }
}
