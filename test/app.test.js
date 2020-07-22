const { assert } = require('chai')
const { assertRevert } = require('@aragon/contract-test-helpers/assertThrow')
const { getEventArgument } = require('@aragon/contract-test-helpers/events')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission, setOpenPermission } = require('./helpers/permissions')
const { now, mineBlocks } = require('./helpers/time-travel')
const {
  collectRewardsForMany,
  newVote,
  vote,
  openRewardsDistributionForEpoch,
  closeRewardsDistributionForCurrentEpoch,
  getAccountsBalance,
  getTotalReward,
  distributeRewardsToMany,
} = require('./helpers/utils')

const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const MockErc20 = artifacts.require('TokenMock')
const Voting = artifacts.require('VotingMock')
const VotingRewards = artifacts.require('VotingRewards')
const Vault = artifacts.require('Vault')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const { hash: nameHash } = require('eth-ens-namehash')

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = '10000000000000000000000000'
const MINIME_TOKEN_BALANCE = 100000
const ONE_BLOCK = 15
const ONE_MINUTE_BLOCK = 4 // 60 / 15 where 15 is block time
const ONE_DAY_BLOCKS = 5760 // 86400 / 15 where 15 is block time
const EPOCH_BLOCKS = ONE_MINUTE_BLOCK * 5
const PERCENTAGE_REWARD = '420000000000000000' // 42 * 100
const LOCK_TIME_BLOCKS = ONE_MINUTE_BLOCK * 10
const MISSING_VOTES_THRESHOLD = 1
const UNLOCKED = 0
const WITHDRAWN = 1
const SUPPORT_REQUIRED_PCT = '910000000000000000' // 91% (high to facilitate tests since the value is irrilevant
const MIN_ACCEPTED_QUORUM_PCT = '910000000000000000' // 91% (high to facilitate tests since the value is irrilevant
const DURATION_BLOCKS = ONE_DAY_BLOCKS * 5
const BUFFER_BLOCKS = 5

contract('VotingRewards', ([appManager, ...accounts]) => {
  let miniMeToken,
    votingRewardBase,
    votingReward,
    voting,
    votingBase,
    rewardsToken,
    baseVaultBase,
    baseVault,
    rewardsVaultBase,
    rewardsVault,
    executionTarget

  let TRANSFER_ROLE,
    CHANGE_EPOCH_DURATION_ROLE,
    CHANGE_VAULT_ROLE,
    CHANGE_VOTING_ROLE,
    CREATE_VOTES_ROLE,
    CHANGE_PERCENTAGE_REWARDS_ROLE,
    DISTRIBUTE_REWARD_ROLE,
    OPEN_REWARDS_DISTRIBUTION_ROLE,
    CLOSE_REWARDS_DISTRIBUTION_ROLE,
    CHANGE_MISSING_VOTES_THRESHOLD_ROLE,
    CHANGE_LOCK_TIME_ROLE,
    CHANGE_REWARD_TOKEN_ROLE

  const NOT_CONTRACT = appManager

  before('deploy base apps', async () => {
    votingRewardBase = await VotingRewards.new()
    CHANGE_EPOCH_DURATION_ROLE = await votingRewardBase.CHANGE_EPOCH_DURATION_ROLE()
    CHANGE_VAULT_ROLE = await votingRewardBase.CHANGE_VAULT_ROLE()
    CHANGE_VOTING_ROLE = await votingRewardBase.CHANGE_VOTING_ROLE()
    CHANGE_PERCENTAGE_REWARDS_ROLE = await votingRewardBase.CHANGE_PERCENTAGE_REWARDS_ROLE()
    DISTRIBUTE_REWARD_ROLE = await votingRewardBase.DISTRIBUTE_REWARD_ROLE()
    OPEN_REWARDS_DISTRIBUTION_ROLE = await votingRewardBase.OPEN_REWARDS_DISTRIBUTION_ROLE()
    CLOSE_REWARDS_DISTRIBUTION_ROLE = await votingRewardBase.CLOSE_REWARDS_DISTRIBUTION_ROLE()
    CHANGE_MISSING_VOTES_THRESHOLD_ROLE = await votingRewardBase.CHANGE_MISSING_VOTES_THRESHOLD_ROLE()
    CHANGE_LOCK_TIME_ROLE = await votingRewardBase.CHANGE_LOCK_TIME_ROLE()
    CHANGE_REWARD_TOKEN_ROLE = await votingRewardBase.CHANGE_REWARD_TOKEN_ROLE()

    votingBase = await Voting.new()
    CREATE_VOTES_ROLE = await votingBase.CREATE_VOTES_ROLE()

    baseVaultBase = await Vault.new()
    rewardsVaultBase = await Vault.new()
    TRANSFER_ROLE = await baseVaultBase.TRANSFER_ROLE()
  })

  beforeEach('deploy dao and token deposit', async () => {
    const daoDeployment = await newDao(appManager)
    dao = daoDeployment.dao
    acl = daoDeployment.acl

    const miniMeTokenFactory = await MiniMeTokenFactory.new()
    miniMeToken = await MiniMeToken.new(
      miniMeTokenFactory.address,
      ETH_ADDRESS,
      0,
      'DaoToken',
      18,
      'DPT',
      true
    )

    votingReward = await VotingRewards.at(
      await newApp(
        dao,
        nameHash('voting-reward.aragonpm.test'),
        votingRewardBase.address,
        appManager
      )
    )

    baseVault = await Vault.at(
      await newApp(
        dao,
        nameHash('base-vault.aragonpm.test'),
        baseVaultBase.address,
        appManager
      )
    )

    rewardsVault = await Vault.at(
      await newApp(
        dao,
        nameHash('rewards-vault.aragonpm.test'),
        rewardsVaultBase.address,
        appManager
      )
    )

    voting = await Voting.at(
      await newApp(
        dao,
        nameHash('voting.aragonpm.test'),
        votingBase.address,
        appManager
      )
    )

    await baseVault.initialize()
    await rewardsVault.initialize()
    await voting.initialize(
      miniMeToken.address,
      SUPPORT_REQUIRED_PCT,
      MIN_ACCEPTED_QUORUM_PCT,
      DURATION_BLOCKS,
      BUFFER_BLOCKS,
      0
    )

    rewardsToken = await MockErc20.new(baseVault.address, MOCK_TOKEN_BALANCE)
    await miniMeToken.generateTokens(appManager, MINIME_TOKEN_BALANCE)
    accounts.forEach(
      async (_account) =>
        await miniMeToken.generateTokens(_account, MINIME_TOKEN_BALANCE)
    )
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreshold) fails', async () => {
    it('Should revert when passed non-contract address as baseVault', async () => {
      await assertRevert(
        votingReward.initialize(
          NOT_CONTRACT,
          rewardsVault.address,
          voting.address,
          ETH_ADDRESS,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          LOCK_TIME_BLOCKS,
          MISSING_VOTES_THRESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed non-contract address as rewardsVault', async () => {
      await assertRevert(
        votingReward.initialize(
          rewardsVault.address,
          NOT_CONTRACT,
          voting.address,
          ETH_ADDRESS,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          LOCK_TIME_BLOCKS,
          MISSING_VOTES_THRESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed non-contract address as voting', async () => {
      await assertRevert(
        votingReward.initialize(
          baseVault.address,
          rewardsVault.address,
          NOT_CONTRACT,
          ETH_ADDRESS,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          LOCK_TIME_BLOCKS,
          MISSING_VOTES_THRESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed non-contract address as deposit token', async () => {
      await assertRevert(
        votingReward.initialize(
          baseVault.address,
          rewardsVault.address,
          voting.address,
          NOT_CONTRACT,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          LOCK_TIME_BLOCKS,
          MISSING_VOTES_THRESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed a negative lock time', async () => {
      await assertRevert(
        votingReward.initialize(
          baseVault.address,
          rewardsVault.address,
          voting.address,
          NOT_CONTRACT,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          -1,
          MISSING_VOTES_THRESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed a negative missing votes threshold', async () => {
      await assertRevert(
        votingReward.initialize(
          baseVault.address,
          rewardsVault.address,
          voting.address,
          NOT_CONTRACT,
          EPOCH_BLOCKS,
          PERCENTAGE_REWARD,
          LOCK_TIME_BLOCKS,
          -1
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreshold)', () => {
    beforeEach(async () => {
      await votingReward.initialize(
        baseVault.address,
        rewardsVault.address,
        voting.address,
        rewardsToken.address,
        EPOCH_BLOCKS,
        PERCENTAGE_REWARD,
        LOCK_TIME_BLOCKS,
        MISSING_VOTES_THRESHOLD
      )
    })

    it('Should set correct variables', async () => {
      const actualVoting = await votingReward.dandelionVoting()
      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualRewardToken = await votingReward.rewardsToken()
      const actualEpochDuration = await votingReward.epochDuration()
      const actualLockTime = await votingReward.lockTime()
      const actualMissingVotesThreshold = await votingReward.missingVotesThreshold()

      assert.strictEqual(actualVoting, voting.address)
      assert.strictEqual(actualBaseVault, baseVault.address)
      assert.strictEqual(actualRewardVault, rewardsVault.address)
      assert.strictEqual(actualRewardToken, rewardsToken.address)
      assert.strictEqual(parseInt(actualEpochDuration), EPOCH_BLOCKS)
      assert.strictEqual(parseInt(actualLockTime), LOCK_TIME_BLOCKS)
      assert.strictEqual(
        parseInt(actualMissingVotesThreshold),
        MISSING_VOTES_THRESHOLD
      )
    })

    it('Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageRewards, lockTime, missingVotesThreshold and rewardsToken', async () => {
      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_EPOCH_DURATION_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_VAULT_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_VOTING_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_PERCENTAGE_REWARDS_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_LOCK_TIME_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_MISSING_VOTES_THRESHOLD_ROLE,
        appManager
      )

      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_REWARD_TOKEN_ROLE,
        appManager
      )

      let receipt = await votingReward.changeEpochDuration(
        EPOCH_BLOCKS + ONE_DAY_BLOCKS,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        parseInt(
          getEventArgument(receipt, 'EpochDurationChanged', 'epochDuration')
        ),
        EPOCH_BLOCKS + ONE_DAY_BLOCKS
      )

      receipt = await votingReward.changeBaseVaultContractAddress(
        rewardsVault.address,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        getEventArgument(receipt, 'BaseVaultChanged', 'baseVault'),
        rewardsVault.address
      )

      receipt = await votingReward.changeRewardsVaultContractAddress(
        baseVault.address,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        getEventArgument(receipt, 'RewardsVaultChanged', 'rewardsVault'),
        baseVault.address
      )

      receipt = await votingReward.changeDandelionVotingContractAddress(
        baseVault.address,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        getEventArgument(receipt, 'DandelionVotingChanged', 'dandelionVoting'),
        baseVault.address
      )

      receipt = await votingReward.changeLockTime(LOCK_TIME_BLOCKS + 15, {
        from: appManager,
      })
      assert.strictEqual(
        parseInt(getEventArgument(receipt, 'LockTimeChanged', 'lockTime')),
        LOCK_TIME_BLOCKS + 15
      )

      receipt = await votingReward.changeMissingVotesThreshold(
        MISSING_VOTES_THRESHOLD + 1,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        parseInt(
          getEventArgument(
            receipt,
            'MissingVoteThresholdChanged',
            'missingVotesThreshold'
          )
        ),
        MISSING_VOTES_THRESHOLD + 1
      )

      receipt = await votingReward.changePercentageReward(
        '100000000000000000',
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        getEventArgument(
          receipt,
          'PercentageRewardsChanged',
          'percentageRewards'
        ).toString(),
        '100000000000000000'
      )

      receipt = await votingReward.changeRewardsTokenContractAddress(
        voting.address,
        {
          from: appManager,
        }
      )
      assert.strictEqual(
        getEventArgument(receipt, 'RewardsTokenChanged', 'rewardsToken'),
        voting.address
      )

      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualVoting = await votingReward.dandelionVoting()
      const actualEpochDuration = parseInt(await votingReward.epochDuration())
      const actualPercentageReward = await votingReward.percentageRewards()
      const actualLockTime = await votingReward.lockTime()
      const actualMissingVotesThreshold = await votingReward.missingVotesThreshold()

      assert.strictEqual(actualBaseVault, rewardsVault.address)
      assert.strictEqual(actualRewardVault, baseVault.address)
      assert.strictEqual(actualVoting, baseVault.address)
      assert.strictEqual(actualEpochDuration, EPOCH_BLOCKS + ONE_DAY_BLOCKS)
      assert.strictEqual(
        actualPercentageReward.toString(),
        '100000000000000000'
      )
      assert.strictEqual(parseInt(actualLockTime), LOCK_TIME_BLOCKS + 15)
      assert.strictEqual(
        parseInt(actualMissingVotesThreshold),
        MISSING_VOTES_THRESHOLD + 1
      )
    })

    it('Should not be able to set epoch because of no permission', async () => {
      await assertRevert(
        votingReward.changeEpochDuration(EPOCH_BLOCKS, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Base Vault because of no permission', async () => {
      await assertRevert(
        votingReward.changeBaseVaultContractAddress(baseVault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Reward Vault because of no permission', async () => {
      await assertRevert(
        votingReward.changeBaseVaultContractAddress(rewardsVault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Voting because of no permission', async () => {
      await assertRevert(
        votingReward.changeDandelionVotingContractAddress(baseVault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Percentage Reward because of no permission', async () => {
      await assertRevert(
        votingReward.changePercentageReward(PERCENTAGE_REWARD, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new lock time because of no permission', async () => {
      await assertRevert(
        votingReward.changeLockTime(LOCK_TIME_BLOCKS, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new missing votes threshold because of no permission', async () => {
      await assertRevert(
        votingReward.changeMissingVotesThreshold(MISSING_VOTES_THRESHOLD, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Percentage Reward because vaule is greater than 100', async () => {
      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_PERCENTAGE_REWARDS_ROLE,
        appManager
      )

      await assertRevert(
        votingReward.changePercentageReward('10000000000000000001', {
          from: appManager,
        }),
        'VOTING_REWARD_PERCENTAGE_REWARD'
      )
    })

    it('Should not be able to set a new rewards token because of no permission', async () => {
      await assertRevert(
        votingReward.changeRewardsTokenContractAddress(voting.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    describe('rewards init fails', async () => {
      beforeEach(async () => {
        executionTarget = await ExecutionTarget.new()

        await setOpenPermission(
          acl,
          voting.address,
          CREATE_VOTES_ROLE,
          appManager
        )
      })

      it('Should fail distributing rewards because of no permission', async () => {
        await assertRevert(
          distributeRewardsToMany(votingReward, [appManager], appManager),
          'APP_AUTH_FAILED'
        )
      })

      it('Should fail because of no votes', async () => {
        await setPermission(
          acl,
          appManager,
          votingReward.address,
          DISTRIBUTE_REWARD_ROLE,
          appManager
        )

        await assertRevert(
          distributeRewardsToMany(votingReward, [appManager], appManager),
          'VOTING_REWARD_VOTING_NO_VOTES'
        )
      })

      it('Should fail on opening a distribition for an epoch because no permission', async () => {
        await assertRevert(
          openRewardsDistributionForEpoch(votingReward, 10, appManager),
          'APP_AUTH_FAILED'
        )
      })

      it('Should fail because it is not possible to distribition for an epoch is closed', async () => {
        await setPermission(
          acl,
          appManager,
          votingReward.address,
          DISTRIBUTE_REWARD_ROLE,
          appManager
        )

        await newVote(
          voting,
          executionTarget.address,
          executionTarget.contract.methods.execute().encodeABI(),
          appManager
        )

        await assertRevert(
          distributeRewardsToMany(votingReward, [appManager], appManager),
          'VOTING_REWARD_EPOCH_REWARDS_DISTRIBUTION_NOT_OPENED'
        )
      })
    })

    describe('rewards', async () => {
      beforeEach(async () => {
        executionTarget = await ExecutionTarget.new()

        await setPermission(
          acl,
          votingReward.address,
          baseVault.address,
          TRANSFER_ROLE,
          appManager
        )

        await setPermission(
          acl,
          votingReward.address,
          rewardsVault.address,
          TRANSFER_ROLE,
          appManager
        )

        await setPermission(
          acl,
          appManager,
          votingReward.address,
          DISTRIBUTE_REWARD_ROLE,
          appManager
        )

        await setPermission(
          acl,
          appManager,
          votingReward.address,
          OPEN_REWARDS_DISTRIBUTION_ROLE,
          appManager
        )

        await setPermission(
          acl,
          appManager,
          votingReward.address,
          CLOSE_REWARDS_DISTRIBUTION_ROLE,
          appManager
        )
      })

      it('Should not be able to collect rewards since there are not', async () => {
        await assertRevert(
          collectRewardsForMany(votingReward, accounts, appManager),
          'VOTING_REWARD_NO_REWARDS'
        )
      })

      it('Should not be able to close distribution since it is not opened', async () => {
        await assertRevert(
          closeRewardsDistributionForCurrentEpoch(votingReward, appManager),
          'VOTING_REWARD_EPOCH_REWARDS_DISTRIBUTION_NOT_OPENED'
        )
      })

      it('Should not be able to open a distribition because startBlockNumberOfCurrentEpoch is less than last distribition', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()
        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }
        await assertRevert(
          openRewardsDistributionForEpoch(
            votingReward,
            startBlockNumberOfCurrentEpoch - EPOCH_BLOCKS,
            appManager
          ),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should not be able to distribute rewards because of too many missing votes', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()
        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          // accounts[0] does not vote
          for (let i = 0; i < accounts.length; i++) {
            if (i !== 0) await vote(voting, voteId, accounts[i])
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )

        await assertRevert(
          votingReward.distributeRewardsTo(accounts[0], { from: appManager }),
          'VOTING_REWARD_TOO_MANY_MISSING_VOTES'
        )
      })

      it('Should be able to collect, distribute rewards for who partecipated actively in voting and catching events', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()

        const intialBalances = await getAccountsBalance(accounts, rewardsToken)
        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
            // in order (if works) to have the minimun equal to expectedReward since balance increase
            await miniMeToken.generateTokens(account, 10)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        let receipt = await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )

        assert.strictEqual(
          parseInt(
            getEventArgument(
              receipt,
              'RewardsDistributionEpochOpened',
              'startBlock'
            )
          ),
          startBlockNumberOfCurrentEpoch
        )

        assert.strictEqual(
          parseInt(
            getEventArgument(
              receipt,
              'RewardsDistributionEpochOpened',
              'endBlock'
            )
          ),
          startBlockNumberOfCurrentEpoch + EPOCH_BLOCKS
        )

        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        receipt = await closeRewardsDistributionForCurrentEpoch(
          votingReward,
          appManager
        )

        assert.strictEqual(
          parseInt(
            getEventArgument(
              receipt,
              'RewardsDistributionEpochClosed',
              'rewardDistributionBlock'
            )
          ),
          receipt.receipt.blockNumber
        )

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          expectedReward.toString(),
          actualVaultBalance.toString()
        )

        for (let account of accounts) {
          const rewards = await votingReward.getRewardsInfo(account)
          // there is only 1 reward x user since there has been only one collectRewardsForMany
          assert.strictEqual(
            parseInt(rewards[0].amount),
            expectedRewardSingleUser
          )
        }

        await mineBlocks(LOCK_TIME_BLOCKS)
        await collectRewardsForMany(votingReward, accounts, appManager)

        const actualBalances = await getAccountsBalance(accounts, rewardsToken)
        for (let account of accounts) {
          assert.strictEqual(
            parseInt(actualBalances[account]),
            parseInt(intialBalances[account]) + expectedRewardSingleUser
          )
        }
      }).timeout(200000)

      it('Should not be able to close a reward distribution twice', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
            // in order (if works) to have the minimun equal to expectedReward since balance increase
            await miniMeToken.generateTokens(account, 10)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )

        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)
        assertRevert(
          closeRewardsDistributionForCurrentEpoch(votingReward, appManager),
          'VOTING_REWARD_EPOCH_REWARDS_DISTRIBUTION_NOT_OPENED'
        )
      }).timeout(200000)

      it('Should be able to collect rewards but not distributing for who partecipated actively in voting because a LOCK_TIME_BLOCKS period is not passed,', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()

        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
            // in order (if works) to have the minimun equal to expectedReward since balance increase
            await miniMeToken.generateTokens(account, 10)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          expectedReward.toString(),
          actualVaultBalance.toString()
        )

        for (let account of accounts) {
          const rewards = await votingReward.getRewardsInfo(account)
          // there is only 1 reward x user since there has been only one collectRewardsForMany
          assert.strictEqual(
            parseInt(rewards[0].amount),
            expectedRewardSingleUser
          )
        }

        await assertRevert(
          collectRewardsForMany(votingReward, accounts, appManager),
          'VOTING_REWARD_NO_REWARDS'
        )
      }).timeout(200000)

      it('Should be able to distribute but not collecting all rewards (only tot/2)', async () => {
        const numVotes = 10
        let startBlockNumberOfCurrentEpoch = await now()

        const intialBalances = await getAccountsBalance(accounts, rewardsToken)
        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)

        await mineBlocks(ONE_BLOCK)
        startBlockNumberOfCurrentEpoch = await now()

        for (let voteId = numVotes + 1; voteId <= numVotes * 2; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          (expectedReward * 2).toString(),
          actualVaultBalance.toString()
        )

        // expected locked 2 rewards
        for (let account of accounts) {
          const rewards = await votingReward.getRewardsInfo(account)
          assert.strictEqual(
            parseInt(rewards[0].amount) + parseInt(rewards[1].amount),
            expectedRewardSingleUser * 2
          )
        }

        // avoid collecting last collected reward
        await mineBlocks(LOCK_TIME_BLOCKS - EPOCH_BLOCKS - 1)
        await collectRewardsForMany(votingReward, accounts, appManager)

        const actualBalances = await getAccountsBalance(accounts, rewardsToken)
        for (let account of accounts) {
          assert.strictEqual(
            parseInt(actualBalances[account]),
            parseInt(intialBalances[account]) + expectedRewardSingleUser
          )
        }
      }).timeout(500000)

      it('Should not be able to open a distribition if there is another one opened', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager)

        await assertRevert(
          openRewardsDistributionForEpoch(
            votingReward,
            startBlockNumberOfCurrentEpoch,
            appManager
          ),
          'VOTING_REWARD_EPOCH_REWARDS_DISTRIBUTION_ALREADY_OPENED'
        )
      }).timeout(50000)

      it('Should not be able to collect rewards 2 times in the same epoch', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()

        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager)

        await assertRevert(
          distributeRewardsToMany(votingReward, accounts, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      }).timeout(50000)

      it('Should not be possible open a distribition 2 times in the same epoch', async () => {
        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          await now(),
          appManager
        )
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)
        await assertRevert(
          openRewardsDistributionForEpoch(
            votingReward,
            await now(),
            appManager
          ),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      }).timeout(20000)

      it('Should handle correctly the number of epochs', async () => {
        const numberOfEpochs = 10
        for (let epoch = 0; epoch < numberOfEpochs; epoch++) {
          await mineBlocks(EPOCH_BLOCKS)
          const startBlockNumberOfCurrentEpoch = await now()
          await openRewardsDistributionForEpoch(
            votingReward,
            startBlockNumberOfCurrentEpoch,
            appManager
          )
          // distributing reward...
          await closeRewardsDistributionForCurrentEpoch(
            votingReward,
            appManager
          )

          const currentEpoch = (await votingReward.currentEpoch()).toString()
          assert.strictEqual(parseInt(currentEpoch), epoch + 1)
        }
      }).timeout(50000)

      it('Should change from Locked to Distributed', async () => {
        const numVotes = 10
        const startBlockNumberOfCurrentEpoch = await now()
        for (let voteId = 1; voteId <= numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await vote(voting, voteId, account)
          }
        }

        await mineBlocks(EPOCH_BLOCKS)
        await openRewardsDistributionForEpoch(
          votingReward,
          startBlockNumberOfCurrentEpoch,
          appManager
        )
        await distributeRewardsToMany(votingReward, accounts, appManager, 5)
        await closeRewardsDistributionForCurrentEpoch(votingReward, appManager)

        for (let account of accounts) {
          const rewards = await votingReward.getRewardsInfo(account)
          for (let { state } of rewards) {
            assert.strictEqual(parseInt(state), UNLOCKED)
          }
        }

        await mineBlocks(EPOCH_BLOCKS + LOCK_TIME_BLOCKS)
        await collectRewardsForMany(votingReward, accounts, appManager)

        for (let account of accounts) {
          const rewards = await votingReward.getRewardsInfo(account)
          for (let { state } of rewards) {
            assert.strictEqual(parseInt(state), WITHDRAWN)
          }
        }
      }).timeout(50000)
    })
  })
})
