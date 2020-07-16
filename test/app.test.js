const { assert } = require('chai')
const { assertRevert } = require('@aragon/contract-test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission, setOpenPermission } = require('./helpers/permissions')
const { timeTravel, now } = require('./helpers/time-travel')
const {
  collectRewardsForAll,
  newVote,
  vote,
  openClaimForEpoch,
  closeClaimForCurrentEpoch,
  getAccountsBalance,
  getTotalReward,
  distributeRewardsForAll
} = require('./helpers/utils')

const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const MockErc20 = artifacts.require('TokenMock')
const Voting = artifacts.require('VotingMock')
const VotingReward = artifacts.require('VotingReward')
const Vault = artifacts.require('Vault')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const { hash: nameHash } = require('eth-ens-namehash')

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = '10000000000000000000000000'
const MINIME_TOKEN_BALANCE = 100000
const ONE_HOURS = 3600
const ONE_DAY = 86400
const SUPPORT_REQUIRED_PCT = '910000000000000000' // 91% (high to facilitate tests since value is irrilevant)
const MIN_ACCEPTED_QUORUM_PCT = '910000000000000000' // 91% (high to facilitate tests since value is irrilevant)
const VOTE_TIME = ONE_DAY * 5 // a vote is opened for 5 days
const EPOCH = ONE_DAY * 15
const PERCENTAGE_REWARD = 42
const LOCK_TIME = ONE_DAY * 365
const MISSING_VOTES_THREESHOLD = 1

contract('VotingReward', ([appManager, ...accounts]) => {
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
    CHANGE_PERCENTAGE_REWARD_ROLE,
    COLLECT_REWARDS_ROLE,
    OPEN_CLAIM_EPOCH_ROLE,
    CHANGE_MISSING_VOTES_THREESHOLD_ROLE,
    CHANGE_LOCK_TIME_ROLE

  const NOT_CONTRACT = appManager

  before('deploy base apps', async () => {
    votingRewardBase = await VotingReward.new()
    CHANGE_EPOCH_DURATION_ROLE = await votingRewardBase.CHANGE_EPOCH_DURATION_ROLE()
    CHANGE_VAULT_ROLE = await votingRewardBase.CHANGE_VAULT_ROLE()
    CHANGE_VOTING_ROLE = await votingRewardBase.CHANGE_VOTING_ROLE()
    CHANGE_PERCENTAGE_REWARD_ROLE = await votingRewardBase.CHANGE_PERCENTAGE_REWARD_ROLE()
    COLLECT_REWARDS_ROLE = await votingRewardBase.COLLECT_REWARDS_ROLE()
    OPEN_CLAIM_EPOCH_ROLE = await votingRewardBase.OPEN_CLAIM_EPOCH_ROLE()
    CHANGE_MISSING_VOTES_THREESHOLD_ROLE = await votingRewardBase.CHANGE_MISSING_VOTES_THREESHOLD_ROLE()
    CHANGE_LOCK_TIME_ROLE = await votingRewardBase.CHANGE_LOCK_TIME_ROLE()

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

    votingReward = await VotingReward.at(
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
      VOTE_TIME
    )

    rewardsToken = await MockErc20.new(baseVault.address, MOCK_TOKEN_BALANCE)
    await miniMeToken.generateTokens(appManager, MINIME_TOKEN_BALANCE)
    accounts.forEach(
      async (_account) =>
        await miniMeToken.generateTokens(_account, MINIME_TOKEN_BALANCE)
    )
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold) fails', async () => {
    it('Should revert when passed non-contract address as baseVault', async () => {
      await assertRevert(
        votingReward.initialize(
          NOT_CONTRACT,
          rewardsVault.address,
          voting.address,
          ETH_ADDRESS,
          ONE_DAY,
          PERCENTAGE_REWARD,
          LOCK_TIME,
          MISSING_VOTES_THREESHOLD
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
          ONE_DAY,
          PERCENTAGE_REWARD,
          LOCK_TIME,
          MISSING_VOTES_THREESHOLD
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
          ONE_DAY,
          PERCENTAGE_REWARD,
          LOCK_TIME,
          MISSING_VOTES_THREESHOLD
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
          ONE_DAY,
          PERCENTAGE_REWARD,
          LOCK_TIME,
          MISSING_VOTES_THREESHOLD
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
          ONE_DAY,
          PERCENTAGE_REWARD,
          -1,
          MISSING_VOTES_THREESHOLD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })

    it('Should revert when passed a negative missing votes threeshold', async () => {
      await assertRevert(
        votingReward.initialize(
          baseVault.address,
          rewardsVault.address,
          voting.address,
          NOT_CONTRACT,
          ONE_DAY,
          PERCENTAGE_REWARD,
          LOCK_TIME,
          -1
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward, uint64 _lockTime, uint256 _missingVotesThreeshold)', () => {
    beforeEach(async () => {
      await votingReward.initialize(
        baseVault.address,
        rewardsVault.address,
        voting.address,
        rewardsToken.address,
        EPOCH,
        PERCENTAGE_REWARD,
        LOCK_TIME,
        MISSING_VOTES_THREESHOLD
      )
    })

    it('Should set correct variables', async () => {
      const actualVoting = await votingReward.voting()
      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualRewardToken = await votingReward.rewardsToken()
      const actualEpochDuration = await votingReward.epochDuration()
      const actualLockTime = await votingReward.lockTime()
      const actualMissingVotesThreeshold = await votingReward.missingVotesThreeshold()

      assert.strictEqual(actualVoting, voting.address)
      assert.strictEqual(actualBaseVault, baseVault.address)
      assert.strictEqual(actualRewardVault, rewardsVault.address)
      assert.strictEqual(actualRewardToken, rewardsToken.address)
      assert.strictEqual(parseInt(actualEpochDuration), EPOCH)
      assert.strictEqual(parseInt(actualLockTime), LOCK_TIME)
      assert.strictEqual(
        parseInt(actualMissingVotesThreeshold),
        MISSING_VOTES_THREESHOLD
      )
    })

    it('Should set able to change baseVault, rewardsVault, voting, epochDuration, percentageReward, lockTime and missingVotesThreeshold', async () => {
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
        CHANGE_PERCENTAGE_REWARD_ROLE,
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
        CHANGE_MISSING_VOTES_THREESHOLD_ROLE,
        appManager
      )

      await votingReward.changeEpochDuration(EPOCH + ONE_DAY, {
        from: appManager,
      })

      await votingReward.changeBaseVault(rewardsVault.address, {
        from: appManager,
      })

      await votingReward.changeRewardVault(baseVault.address, {
        from: appManager,
      })

      await votingReward.changeVoting(baseVault.address, {
        from: appManager,
      })

      await votingReward.changeLockTime(LOCK_TIME + 1, {
        from: appManager,
      })

      await votingReward.changeMissingVotesThreeshold(
        MISSING_VOTES_THREESHOLD + 1,
        {
          from: appManager,
        }
      )

      await votingReward.changePercentageReward(PERCENTAGE_REWARD + 1, {
        from: appManager,
      })

      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualVoting = await votingReward.voting()
      const actualEpochDuration = parseInt(await votingReward.epochDuration())
      const actualPercentageReward = parseInt(
        await votingReward.percentageReward()
      )
      const actualLockTime = await votingReward.lockTime()
      const actualMissingVotesThreeshold = await votingReward.missingVotesThreeshold()

      assert.strictEqual(actualBaseVault, rewardsVault.address)
      assert.strictEqual(actualRewardVault, baseVault.address)
      assert.strictEqual(actualVoting, baseVault.address)
      assert.strictEqual(actualEpochDuration, EPOCH + ONE_DAY)
      assert.strictEqual(actualPercentageReward, PERCENTAGE_REWARD + 1)
      assert.strictEqual(parseInt(actualLockTime), LOCK_TIME + 1)
      assert.strictEqual(
        parseInt(actualMissingVotesThreeshold),
        MISSING_VOTES_THREESHOLD + 1
      )
    })

    it('Should not be able to set epoch because of no permission', async () => {
      await assertRevert(
        votingReward.changeEpochDuration(EPOCH, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Base Vault because of no permission', async () => {
      await assertRevert(
        votingReward.changeBaseVault(baseVault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Reward Vault because of no permission', async () => {
      await assertRevert(
        votingReward.changeBaseVault(rewardsVault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Voting because of no permission', async () => {
      await assertRevert(
        votingReward.changeVoting(baseVault.address, {
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
        votingReward.changeLockTime(LOCK_TIME, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new missing votes threeshold because of no permission', async () => {
      await assertRevert(
        votingReward.changeMissingVotesThreeshold(MISSING_VOTES_THREESHOLD, {
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
        CHANGE_PERCENTAGE_REWARD_ROLE,
        appManager
      )

      await assertRevert(
        votingReward.changePercentageReward(101, {
          from: appManager,
        }),
        'VOTING_REWARD_PERCENTAGE_REWARD'
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

      it('Should fail because of no permission to collectRewardsForAll rewards', async () => {
        await assertRevert(
          collectRewardsForAll(votingReward, [appManager], appManager),
          'APP_AUTH_FAILED'
        )
      })

      it('Should fail because of not votes', async () => {
        await setPermission(
          acl,
          appManager,
          votingReward.address,
          COLLECT_REWARDS_ROLE,
          appManager
        )

        await assertRevert(
          collectRewardsForAll(votingReward, [appManager], appManager),
          'VOTING_REWARD_VOTING_NO_VOTES'
        )
      })

      it('Should fail on opening a claim for an epoch because no permission', async () => {
        await assertRevert(
          openClaimForEpoch(votingReward, 10, appManager),
          'APP_AUTH_FAILED'
        )
      })

      it('Should fail because it is not possible to claim for an epoch is closed', async () => {
        await setPermission(
          acl,
          appManager,
          votingReward.address,
          COLLECT_REWARDS_ROLE,
          appManager
        )

        await newVote(
          voting,
          executionTarget.address,
          executionTarget.contract.methods.execute().encodeABI(),
          appManager
        )

        await assertRevert(
          collectRewardsForAll(votingReward, [appManager], appManager),
          'VOTING_REWARD_CLAIM_NOT_OPENED'
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
          COLLECT_REWARDS_ROLE,
          appManager
        )

        await setPermission(
          acl,
          appManager,
          votingReward.address,
          OPEN_CLAIM_EPOCH_ROLE,
          appManager
        )
      })

      it('Should not be able to open a claim because claimStart is less than last claim', async () => {
        const numVotes = 10
        const claimStart = await now()
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS / 5)
            await vote(voting, voteId, account)
          }
        }
        await assertRevert(
          openClaimForEpoch(votingReward, claimStart - EPOCH, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should be able to collect and distribute rewards for who partecipated actively in voting', async () => {
        const numVotes = 10
        const claimStart = await now()

        const intialBalances = await getAccountsBalance(accounts, rewardsToken)
        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD,
          numVotes
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length

        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)
        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager)
        await closeClaimForCurrentEpoch(votingReward, appManager)

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          expectedReward.toString(),
          actualVaultBalance.toString()
        )

        for (let account of accounts) {
          const rewards = await votingReward.getLockedRewards(account)
          // there is only 1 reward x user since there has been only one collectRewardsForAll
          assert.strictEqual(
            parseInt(rewards[0].amount),
            expectedRewardSingleUser
          )
        }
        
        await timeTravel(LOCK_TIME)
        await distributeRewardsForAll(votingReward, accounts, appManager)

        const actualBalances = await getAccountsBalance(accounts, rewardsToken)
        for (let account of accounts) {
          assert.strictEqual(
            parseInt(actualBalances[account]),
            parseInt(intialBalances[account]) + expectedRewardSingleUser
          )
        }
      })

      it('Should be able to collect rewards but not distributing for who partecipated actively in voting because a LOCK_TIME period is not passed,', async () => {
        const numVotes = 10
        const claimStart = await now()

        const intialBalances = await getAccountsBalance(accounts, rewardsToken)
        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD,
          numVotes
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length

        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)
        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager)
        await closeClaimForCurrentEpoch(votingReward, appManager)

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          expectedReward.toString(),
          actualVaultBalance.toString()
        )

        for (let account of accounts) {
          const rewards = await votingReward.getLockedRewards(account)
          // there is only 1 reward x user since there has been only one collectRewardsForAll
          assert.strictEqual(
            parseInt(rewards[0].amount),
            expectedRewardSingleUser
          )
        }
        
        await distributeRewardsForAll(votingReward, accounts, appManager)

        const actualBalances = await getAccountsBalance(accounts, rewardsToken)
        for (let account of accounts) {
          assert.strictEqual(
            parseInt(actualBalances[account]),
            parseInt(intialBalances[account])
          )
        }
      })

      it('Should be able to collect but not distribute all rewards (only tot/2)', async () => {
        const numVotes = 10
        let claimStart = await now()

        const intialBalances = await getAccountsBalance(accounts, rewardsToken)
        const expectedReward = await getTotalReward(
          accounts,
          miniMeToken,
          PERCENTAGE_REWARD,
          numVotes
        )
        // it works because users have the same balance of miniMeToken
        const expectedRewardSingleUser = expectedReward / accounts.length
          
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)

        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager, 5)
        await closeClaimForCurrentEpoch(votingReward, appManager)

        claimStart = await now()

        for (let voteId = numVotes; voteId < numVotes * 2; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)

        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager, 5)
        await closeClaimForCurrentEpoch(votingReward, appManager)

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
          const rewards = await votingReward.getLockedRewards(account)
          assert.strictEqual(
            parseInt(rewards[0].amount) + parseInt(rewards[1].amount),
            expectedRewardSingleUser * 2
          )
        }
        
        // avoid to distribute last collected reward
        await timeTravel(LOCK_TIME - EPOCH - 1)
        await distributeRewardsForAll(votingReward, accounts, appManager)

        const actualBalances = await getAccountsBalance(accounts, rewardsToken)
        for (let account of accounts) {
          assert.strictEqual(
            parseInt(actualBalances[account]),
            parseInt(intialBalances[account]) + expectedRewardSingleUser
          )
        }
      }).timeout(50000)

      it('Should not be able to open a claim if there is another one opened', async () => {
        const numVotes = 10
        const claimStart = await now()

        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)
        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager)

        await assertRevert(
          openClaimForEpoch(votingReward, claimStart, appManager),
          'VOTING_REWARD_ERROR_EPOCH_CLAIM_ALREADY_OPENED'
        )
      })

      it('Should not be able to collect rewards 2 times in the same epoch', async () => {
        const numVotes = 10
        const claimStart = await now()

        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          for (let account of accounts) {
            await timeTravel(ONE_HOURS)
            await vote(voting, voteId, account)
          }
        }

        await timeTravel(EPOCH)
        await openClaimForEpoch(votingReward, claimStart, appManager)
        await collectRewardsForAll(votingReward, accounts, appManager)

        await assertRevert(
          collectRewardsForAll(votingReward, accounts, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should not be possible open a claim 2 times in the same epoch', async () => {
        await timeTravel(EPOCH)
        await openClaimForEpoch(votingReward, await now(), appManager)
        await closeClaimForCurrentEpoch(votingReward, appManager)
        await assertRevert(
          openClaimForEpoch(votingReward, await now(), appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should handle correctly the number of epochs', async () => {
        const numberOfEpochs = 50
        for (let epoch = 0; epoch < numberOfEpochs; epoch++) {
          await timeTravel(EPOCH)
          const claimStart = await now()
          await openClaimForEpoch(votingReward, claimStart, appManager)
          // distributing reward...
          await closeClaimForCurrentEpoch(votingReward, appManager)

          const currentEpoch = (await votingReward.currentEpoch()).toString()
          assert.strictEqual(parseInt(currentEpoch), epoch + 1)
        }
      })
    })
  })
})
