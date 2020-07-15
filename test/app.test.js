const { assert } = require('chai')
const { assertRevert } = require('@aragon/contract-test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission, setOpenPermission } = require('./helpers/permissions')
const { timeTravel, now } = require('./helpers/time-travel')
const {
  collectRewards,
  collectForAddress,
  newVote,
  vote,
  openClaimForEpoch,
  closeClaimForEpoch,
  getAccountsBalance,
  getTotalReward,
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
const MOCK_TOKEN_BALANCE_TO_DISTRIBUTE = '100000000'
const MINIME_TOKEN_BALANCE = 100000
const ONE_HOURS = 3600
const ONE_DAY = 86400
const SUPPORT_REQUIRED_PCT = '910000000000000000' // 91% (high to facilitate tests since value is irrilevant)
const MIN_ACCEPTED_QUORUM_PCT = '910000000000000000' // 91% (high to facilitate tests since value is irrilevant)
const VOTE_TIME = ONE_DAY * 5 // a vote is opened for 5 days
const EPOCH = ONE_DAY * 365
const PERCENTAGE_REWARD = 42

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
    CHANGE_EPOCH_ROLE,
    CHANGE_VAULT_ROLE,
    CHANGE_VOTING_ROLE,
    CREATE_VOTES_ROLE,
    CHANGE_PERCENTAGE_REWARD_ROLE,
    COLLECT_REWARDS_ROLE,
    OPEN_CLAIM_EPOCH_ROLE

  const NOT_CONTRACT = appManager

  before('deploy base apps', async () => {
    votingRewardBase = await VotingReward.new()
    CHANGE_EPOCH_ROLE = await votingRewardBase.CHANGE_EPOCH_ROLE()
    CHANGE_VAULT_ROLE = await votingRewardBase.CHANGE_VAULT_ROLE()
    CHANGE_VOTING_ROLE = await votingRewardBase.CHANGE_VOTING_ROLE()
    CHANGE_PERCENTAGE_REWARD_ROLE = await votingRewardBase.CHANGE_PERCENTAGE_REWARD_ROLE()
    COLLECT_REWARDS_ROLE = await votingRewardBase.COLLECT_REWARDS_ROLE()
    OPEN_CLAIM_EPOCH_ROLE = await votingRewardBase.OPEN_CLAIM_EPOCH_ROLE()

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

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward) fails', async () => {
    it('Should revert when passed non-contract address as baseVault', async () => {
      await assertRevert(
        votingReward.initialize(
          NOT_CONTRACT,
          rewardsVault.address,
          voting.address,
          ETH_ADDRESS,
          ONE_DAY,
          PERCENTAGE_REWARD
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
          PERCENTAGE_REWARD
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
          PERCENTAGE_REWARD
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
          PERCENTAGE_REWARD
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _epochDuration, uint64 _percentageReward)', () => {
    beforeEach(async () => {
      await votingReward.initialize(
        baseVault.address,
        rewardsVault.address,
        voting.address,
        rewardsToken.address,
        EPOCH,
        PERCENTAGE_REWARD
      )
    })

    it('Should set correct variables', async () => {
      const actualVoting = await votingReward.voting()
      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualRewardToken = await votingReward.rewardsToken()

      assert.strictEqual(actualVoting, voting.address)
      assert.strictEqual(actualBaseVault, baseVault.address)
      assert.strictEqual(actualRewardVault, rewardsVault.address)
      assert.strictEqual(actualRewardToken, rewardsToken.address)
    })

    it('Should set able to change baseVault, rewardsVault voting and minimun seconds', async () => {
      await setPermission(
        acl,
        appManager,
        votingReward.address,
        CHANGE_EPOCH_ROLE,
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

      await votingReward.changeEpoch(EPOCH + ONE_DAY, {
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

      assert.strictEqual(actualBaseVault, rewardsVault.address)
      assert.strictEqual(actualRewardVault, baseVault.address)
      assert.strictEqual(actualVoting, baseVault.address)
      assert.strictEqual(actualEpochDuration, EPOCH + ONE_DAY)
      assert.strictEqual(actualPercentageReward, PERCENTAGE_REWARD + 1)
    })

    it('Should not be able to set epoch because of no permission', async () => {
      await assertRevert(
        votingReward.changeEpoch(EPOCH, {
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

    describe('claimReward() init fails', async () => {
      beforeEach(async () => {
        executionTarget = await ExecutionTarget.new()

        await setOpenPermission(
          acl,
          voting.address,
          CREATE_VOTES_ROLE,
          appManager
        )
      })

      it('Should fail because of no permission to collectRewards rewards', async () => {
        await assertRevert(
          collectRewards(votingReward, [appManager], appManager),
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
          collectRewards(votingReward, [appManager], appManager),
          'VOTING_REWARD_VOTING_NO_VOTES'
        )
      })

      it('Should fail on opening an epoch claimi because no permission', async () => {
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
          collectRewards(votingReward, [appManager], appManager),
          'VOTING_REWARD_CLAIM_NOT_OPENED'
        )
      })
    })

    describe('claimReward()', async () => {
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

      it('Should be able to collect rewards for who partecipated actively in voting because an epoch is passed (TO FINISH)', async () => {
        const numVotes = 10
        const claimStart = await now()

        const expectedReward =
          await getTotalReward(accounts, miniMeToken, PERCENTAGE_REWARD, numVotes)

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
        await collectRewards(votingReward, accounts, appManager)

        // base vault must contain all rewards
        const actualVaultBalance = await rewardsToken.balanceOf(
          rewardsVault.address
        )
        assert.strictEqual(
          expectedReward.toString(),
          actualVaultBalance.toString()
        )
        // TODO: finish once locking is complete
      })

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
        await collectRewards(votingReward, accounts, appManager)

        await assertRevert(
          openClaimForEpoch(votingReward, claimStart, appManager),
          'ERROR_EPOCH_CLAIM_ALREADY_OPENED'
        )
      })

      it('Should not be able to claim 2 times for the same epoch', async () => {
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
        await collectRewards(votingReward, accounts, appManager)

        await assertRevert(
          collectRewards(votingReward, accounts, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })
    })
  })
})
