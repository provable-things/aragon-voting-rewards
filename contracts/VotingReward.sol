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


contract VotingReward is AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    // prettier-ignore
    bytes32 public constant CHANGE_EPOCH_DURATION_ROLE = keccak256("CHANGE_EPOCH_DURATION_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_MISSING_VOTES_THREESHOLD_ROLE = keccak256("CHANGE_MISSING_VOTES_THREESHOLD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_LOCK_TIME_ROLE = keccak256("CHANGE_LOCK_TIME_ROLE");
    // prettier-ignore
    bytes32 public constant OPEN_REWARDS_DISTRIBUTION_ROLE = keccak256("OPEN_REWARDS_DISTRIBUTION_ROLE");
    // prettier-ignore
    bytes32 public constant CLOSE_REWARDS_DISTRIBUTION_ROLE = keccak256("CLOSE_REWARDS_DISTRIBUTION_ROLE");
    // prettier-ignore
    bytes32 public constant DISTRIBUTE_REWARDS_ROLE = keccak256("DISTRIBUTE_REWARDS_ROLE");
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
    string private constant ERROR_EPOCH_DISTRIBUTION_NOT_OPENED = "VOTING_REWARD_EPOCH_DISTRIBUTION_NOT_OPENED";
    // prettier-ignore
    string private constant ERROR_EPOCH_DISTRIBUTION_ALREADY_OPENED = "VOTING_REWARD_EPOCH_DISTRIBUTION_ALREADY_OPENED";
    // prettier-ignore
    string private constant ERROR_WRONG_VALUE = "VOTING_REWARD_WRONG_VALUE";

    enum RewardState {Unlocked, Withdrawn}

    struct Reward {
        uint256 amount;
        RewardState state;
        uint64 lockBlock;
        uint64 lockTime;
    }

    Vault public baseVault;
    Vault public rewardsVault;
    DandelionVoting public voting;

    address public rewardsToken;
    uint256 public percentageReward;
    uint256 public missingVotesThreeshold;

    uint64 public epochDuration;
    uint64 public currentEpoch;
    uint64 public fromBlock;
    uint64 public lockTime;
    uint64 public lastDistributionBlock;
    uint64 private deployBlock;

    bool public isClaimOpened;

    mapping(address => uint64) private lasBlockDistributedRewards;
    mapping(address => Reward[]) public addressRewards;

    event BaseVaultChanged(address baseVault);
    event RewardVaultChanged(address rewardsVault);
    event VotingChanged(address voting);
    event PercentageRewardChanged(uint256 percentageReward);
    event RewardLocked(address beneficiary, uint256 amount, uint64 lockTime);
    event RewardDistributed(address beneficiary, uint256 amount);
    event EpochDurationChanged(uint64 epoch);
    event MissingVoteThreesholdChanged(uint256 amount);
    event LockTimeChanged(uint64 amount);
    event ClaimEpochOpened(uint64 start, uint64 end);
    event ClaimEpochClosed(uint64 date);

    /**
     * @notice Initialize VotingReward app contract
     * @param _baseVault Vault address from which token are taken
     * @param _rewardsVault Vault address to which token are put
     * @param _voting DandelionVoting address
     * @param _rewardsToken Accepted token address
     * @param _epochDuration number of blocks for which an epoch is opened
     * @param _percentageReward percentage of a reward expressed as a number between 10^16 and 10^18
     * @param _lockTime number of blocks for which token will be locked after colleting reward
     * @param _missingVotesThreeshold number of missing votes allowed in an epoch
     */
    function initialize(
        address _baseVault,
        address _rewardsVault,
        address _voting,
        address _rewardsToken,
        uint64 _epochDuration,
        uint256 _percentageReward,
        uint64 _lockTime,
        uint256 _missingVotesThreeshold
    ) external onlyInit {
        require(isContract(_baseVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsVault), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        require(isContract(_rewardsToken), ERROR_ADDRESS_NOT_CONTRACT);
        require(_percentageReward <= PCT_BASE, ERROR_PERCENTAGE_REWARD);
        require(_lockTime >= 0, ERROR_WRONG_VALUE);
        require(_missingVotesThreeshold >= 0, ERROR_WRONG_VALUE);

        baseVault = Vault(_baseVault);
        rewardsVault = Vault(_rewardsVault);
        voting = DandelionVoting(_voting);
        rewardsToken = _rewardsToken;
        epochDuration = _epochDuration;
        percentageReward = _percentageReward;
        missingVotesThreeshold = _missingVotesThreeshold;
        lockTime = _lockTime;

        deployBlock = getBlockNumber64();
        lastDistributionBlock = getBlockNumber64();
        currentEpoch = 0;

        initialized();
    }

    /**
     * @notice Open the claim for the current epoch from _fromBlock
     * @param _fromBlock block from which starting to look for rewards
     */
    function openDistributionForEpoch(uint64 _fromBlock)
        external
        auth(OPEN_REWARDS_DISTRIBUTION_ROLE)
    {
        require(!isClaimOpened, ERROR_EPOCH_DISTRIBUTION_ALREADY_OPENED);
        require(_fromBlock > lastDistributionBlock, ERROR_EPOCH);
        require(
            getBlockNumber64() - lastDistributionBlock > epochDuration,
            ERROR_EPOCH
        );

        fromBlock = _fromBlock;
        isClaimOpened = true;

        emit ClaimEpochOpened(_fromBlock, _fromBlock + epochDuration);
    }

    /**
     * @notice close distribution for current epoch if it's opened and starts a new one
     */
    function closeDistributionForCurrentEpoch()
        external
        auth(CLOSE_REWARDS_DISTRIBUTION_ROLE)
    {
        isClaimOpened = false;
        currentEpoch = currentEpoch.add(1);
        lastDistributionBlock = getBlockNumber64();
        emit ClaimEpochClosed(lastDistributionBlock);
    }

    /**
     * @notice collect rewards for a list of address. Tokens are locked for lockTime in rewardsVault
     * @param _beneficiaries address that are looking for reward
     * @dev this function should be called from outside each _epochDuration seconds
     */
    function distributeRewardsForAll(address[] _beneficiaries)
        external
        auth(DISTRIBUTE_REWARDS_ROLE)
    {
        require(voting.votesLength() > 0, ERROR_VOTING_NO_VOTES);
        require(isClaimOpened, ERROR_EPOCH_DISTRIBUTION_NOT_OPENED);

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            distributeRewardsFor(_beneficiaries[i]);
        }
    }

    /**
     * @notice distribute rewards for a list of address
     *         if lockTime is passed since when tokens have been distributed
     * @param _beneficiaries addresses that should be fund with rewards
     */
    function collectRewardsForAll(address[] _beneficiaries) external {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            collectRewardsFor(_beneficiaries[i]);
        }
    }

    /**
     * @notice Change minimum number of seconds to claim voting rewards
     * @param _epochDuration number of seconds minimun to claim access to voting rewards
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
     * @param _missingVotesThreeshold number of seconds minimun to claim access to voting rewards
     */
    function changeMissingVotesThreeshold(uint256 _missingVotesThreeshold)
        external
        auth(CHANGE_MISSING_VOTES_THREESHOLD_ROLE)
    {
        require(_missingVotesThreeshold >= 0, ERROR_WRONG_VALUE);
        missingVotesThreeshold = _missingVotesThreeshold;

        emit MissingVoteThreesholdChanged(_missingVotesThreeshold);
    }

    /**
     * @notice Change minimum number of missing votes allowed
     * @param _lockTime number of seconds for wich tokens will be locked after collecting reward
     */
    function changeLockTime(uint64 _lockTime)
        external
        auth(CHANGE_LOCK_TIME_ROLE)
    {
        require(_lockTime >= 0, ERROR_WRONG_VALUE);
        lockTime = _lockTime;

        emit MissingVoteThreesholdChanged(_lockTime);
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
     * @notice Change DandelionVoting
     * @param _voting new voting address
     */
    function changeVoting(address _voting) external auth(CHANGE_VOTING_ROLE) {
        require(isContract(_voting), ERROR_ADDRESS_NOT_CONTRACT);
        voting = DandelionVoting(_voting);

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
        require(_percentageReward <= PCT_BASE, ERROR_PERCENTAGE_REWARD);
        percentageReward = _percentageReward;

        emit PercentageRewardChanged(percentageReward);
    }

    /**
     * @notice Returns all rewards given an address
     * @param _beneficiary address of which we want to get all rewards
     */
    function getRewards(address _beneficiary) external view returns (Reward[]) {
        // prettier-ignore
        Reward[] storage rewards = addressRewards[_beneficiary];
        return rewards;
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     * @param _beneficiary address to which the deposit will be transferred if successful
     * @dev baseVault should have TRANSFER_ROLE permission
     */
    function distributeRewardsFor(address _beneficiary)
        public
        auth(DISTRIBUTE_REWARDS_ROLE)
    {
        require(isClaimOpened, ERROR_EPOCH_DISTRIBUTION_NOT_OPENED);

        uint64 lastBlockDistributedReward = 0;
        if (lasBlockDistributedRewards[_beneficiary] != 0) {
            lastBlockDistributedReward = lasBlockDistributedRewards[_beneficiary];
        } else {
            lastBlockDistributedReward = deployBlock;
        }

        // avoid double collecting for the same epoch
        require(
            fromBlock.add(epochDuration) > lastBlockDistributedReward,
            ERROR_EPOCH
        );

        uint64 claimEnd = fromBlock.add(epochDuration);
        uint256 reward = _calculateReward(
            _beneficiary,
            fromBlock,
            claimEnd,
            missingVotesThreeshold
        );

        // TODO: understand if it's better to set the date
        // equal to now(timestamp) or the most recent vote date
        lasBlockDistributedRewards[_beneficiary] = getBlockNumber64();

        addressRewards[_beneficiary].push(
            Reward(reward, RewardState.Unlocked, getBlockNumber64(), lockTime)
        );

        baseVault.transfer(rewardsToken, rewardsVault, reward);
        emit RewardLocked(_beneficiary, reward, lockTime);
    }

    /**
     * @notice distribute rewards for an address if lockTime is passed since when tokens have been distributed
     * @param _beneficiary address that should be fund with rewards
     * @dev rewardsVault should have TRANSFER_ROLE permission
     */
    function collectRewardsFor(address _beneficiary) public {
        uint64 timestamp = getBlockNumber64();
        // prettier-ignore
        Reward[] storage rewards = addressRewards[_beneficiary];

        for (uint256 i = 0; i < rewards.length; i++) {
            if (timestamp - rewards[i].lockBlock > rewards[i].lockTime) {
                rewardsVault.transfer(
                    rewardsToken,
                    _beneficiary,
                    rewards[i].amount
                );
                rewards[i].state = RewardState.Withdrawn;

                emit RewardDistributed(_beneficiary, rewards[i].amount);
            }
        }
    }

    /**
     * @notice Reward is calculated as the minimun balance between the
     *         end of an epoch (now) and the balance at the first
     *         vote in an epoch (in percentage) for each vote happened within the epoch
     * @param _beneficiary beneficiary
     * @param _from block from wich starting looking for votes
     * @param _to   block to wich stopping looking for votes
     * @param _missingVotesThreeshold number of vote to which is possible to don't vote
     */
    function _calculateReward(
        address _beneficiary,
        uint64 _from,
        uint64 _to,
        uint256 _missingVotesThreeshold
    ) internal view returns (uint256 balance) {
        MiniMeToken token = MiniMeToken(voting.token());

        uint256 missingVotes = 0;
        uint256 minimunBalance = token.balanceOfAt(
            _beneficiary,
            getBlockNumber64()
        );

        // voteId starts from 1 in DandelionVoting
        for (uint256 voteId = voting.votesLength(); voteId > 1; voteId--) {
            uint64 startBlock;
            uint64 snapshotBlock;
            (, , startBlock, , snapshotBlock, , , , , , ) = voting.getVote(
                voteId.sub(1)
            );

            if (startBlock >= _from && startBlock <= _to) {
                DandelionVoting.VoterState state = voting.getVoterState(
                    voteId.sub(1),
                    _beneficiary
                );

                if (state == DandelionVoting.VoterState.Absent) {
                    missingVotes = missingVotes.add(1);
                }

                require(
                    missingVotes <= _missingVotesThreeshold,
                    ERROR_TOO_MUCH_MISSING_VOTES
                );

                uint256 balanceAtVote = token.balanceOfAt(
                    _beneficiary,
                    snapshotBlock
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
