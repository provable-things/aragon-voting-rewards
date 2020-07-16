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
    bytes32 public constant CHANGE_EPOCH_DURATION_ROLE = keccak256("CHANGE_EPOCH_DURATION_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_MISSING_VOTES_THREESHOLD_ROLE = keccak256("CHANGE_MISSING_VOTES_THREESHOLD_ROLE");
    // prettier-ignore
    bytes32 public constant CHANGE_LOCK_TIME_ROLE = keccak256("CHANGE_LOCK_TIME_ROLE");
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
    string private constant ERROR_EPOCH_CLAIM_ALREADY_OPENED = "VOTING_REWARD_ERROR_EPOCH_CLAIM_ALREADY_OPENED";
    // prettier-ignore
    string private constant ERROR_WRONG_VALUE = "VOTING_REWARD_WRONG_VALUE";

    struct LockedReward {
        uint256 amount;
        uint64 lockDate;
    }

    Vault public baseVault;
    Vault public rewardsVault;
    Voting public voting;

    address public rewardsToken;
    uint256 public percentageReward;
    uint256 public missingVotesThreeshold;

    uint64 public epochDuration;
    uint64 public currentEpoch;
    uint64 private deployDate;
    uint64 public claimStart;
    uint64 public lastClaimDate;
    uint64 public lockTime;

    bool public isClaimOpened;

    mapping(address => uint64) public lastDateClaimedRewards;
    mapping(address => LockedReward[]) public addressLockedRewards;

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
     * @param _voting Voting address
     * @param _rewardsToken Accepted token address
     * @param _epochDuration number of seconds minimun to have access to voting rewards
     * @param _percentageReward percentage of a reward
     * @param _lockTime number of seconds for which token will be locked after colleting reward
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
        require(
            percentageReward >= 0 && _percentageReward <= 100,
            ERROR_PERCENTAGE_REWARD
        );
        require(_lockTime >= 0, ERROR_WRONG_VALUE);
        require(_missingVotesThreeshold >= 0, ERROR_WRONG_VALUE);

        baseVault = Vault(_baseVault);
        rewardsVault = Vault(_rewardsVault);
        voting = Voting(_voting);
        rewardsToken = _rewardsToken;
        epochDuration = _epochDuration;
        percentageReward = _percentageReward;
        missingVotesThreeshold = _missingVotesThreeshold;
        lockTime = _lockTime;

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
        require(getTimestamp64() - lastClaimDate >= epochDuration, ERROR_EPOCH);

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
     * @notice collect rewards for a list of address. Tokens are locked for lockTime in rewardsVault
     * @param _beneficiaries address that are looking for reward
     * @dev this function should be called from outside each _epochDuration seconds
     */
    function collectRewardsForAll(address[] _beneficiaries)
        external
        auth(COLLECT_REWARDS_ROLE)
    {
        require(voting.votesLength() > 0, ERROR_VOTING_NO_VOTES);
        require(isClaimOpened, ERROR_EPOCH_CLAIM_NOT_OPENED);

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            collectRewardsFor(_beneficiaries[i]);
        }
    }

    /**
     * @notice distribute rewards for a list of address
     *         if lockTime is passed since when tokens have been distributed
     * @param _beneficiaries addresses that should be fund with rewards
     */
    function distributeRewardsForAll(address[] _beneficiaries) external {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            distributeRewardsFor(_beneficiaries[i]);
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
     * @notice Returns all locked rewards given an address
     * @param _beneficiary address of which there are locked rewards
     */
    function getLockedRewards(address _beneficiary)
        external
        view
        returns (LockedReward[])
    {
        // prettier-ignore
        LockedReward[] storage lockedRewards = addressLockedRewards[_beneficiary];
        return lockedRewards;
    }

    /**
     * @notice Check if msg.sender is able to be rewarded, and in positive case,
     *         he will be funded with the corresponding earned amount of tokens
     * @param _beneficiary address to which the deposit will be transferred if successful
     * @dev baseVault should have TRANSFER_ROLE permission
     */
    function collectRewardsFor(address _beneficiary)
        public
        auth(COLLECT_REWARDS_ROLE)
    {
        require(isClaimOpened, ERROR_EPOCH_CLAIM_NOT_OPENED);

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
            missingVotesThreeshold
        );

        uint256 reward = _calculatePercentage(
            incrementalBalance,
            percentageReward
        );

        // TODO: understand if it's better to set the date
        // equal to now(timestamp) or the most recent vote date
        lastDateClaimedRewards[_beneficiary] = getTimestamp64();

        // prettier-ignore
        LockedReward[] storage lockedRewards = addressLockedRewards[_beneficiary];
        uint256 index = _whereInsert(lockedRewards);
        if (index == lockedRewards.length) {
            lockedRewards.push(LockedReward(reward, getTimestamp64()));
        } else {
            // insert in a deleted slot
            lockedRewards[index] = LockedReward(reward, getTimestamp64());
        }

        baseVault.transfer(rewardsToken, rewardsVault, reward);
        emit RewardLocked(_beneficiary, reward, lockTime);
    }

    /**
     * @notice distribute rewards for an address if lockTime is passed since when tokens have been distributed
     * @param _beneficiary address that should be fund with rewards
     * @dev rewardsVault should have TRANSFER_ROLE permission
     */
    function distributeRewardsFor(address _beneficiary) public {
        uint64 timestamp = getTimestamp64();
        // prettier-ignore
        LockedReward[] storage lockedRewards = addressLockedRewards[_beneficiary];

        for (uint256 i = 0; i < lockedRewards.length; i++) {
            if (timestamp - lockedRewards[i].lockDate > lockTime) {
                rewardsVault.transfer(
                    rewardsToken,
                    _beneficiary,
                    lockedRewards[i].amount
                );

                emit RewardDistributed(_beneficiary, lockedRewards[i].amount);
                delete lockedRewards[i];
            }
        }
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
     * @notice Calculates a percentage
     */
    function _calculatePercentage(uint256 _value, uint256 _pct)
        internal
        pure
        returns (uint256)
    {
        return _value.mul(_pct).div(100);
    }

    /**
     * @notice Check is it's possible to insert a new locked reward in a deleted slot
     * @param _lockedRewards locked rewards for an address
     */
    function _whereInsert(LockedReward[] memory _lockedRewards)
        internal
        pure
        returns (uint256)
    {
        for (uint64 i = 0; i < _lockedRewards.length; i++) {
            if (_isLockedRewardEmpty(_lockedRewards[i])) {
                return i;
            }
        }

        return _lockedRewards.length;
    }

    /**
     * @notice Check if a LockedReward is empty
     * @param _lockedReward locked reward
     */
    function _isLockedRewardEmpty(LockedReward memory _lockedReward)
        internal
        pure
        returns (bool)
    {
        return _lockedReward.lockDate == 0 && _lockedReward.amount == 0;
    }
}
