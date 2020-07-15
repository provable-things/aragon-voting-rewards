const { assert } = require('chai')
const { assertRevert } = require('@aragon/contract-test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission, setOpenPermission } = require('./helpers/permissions')
const timeTravel = require('./helpers/time-travel')
const { claim, newVote, vote } = require('./helpers/utils')
const { getEventArgument } = require('@aragon/test-helpers/events')

const MiniMeToken = artifacts.require('MiniMeToken')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const MockErc20 = artifacts.require('TokenMock')
const Voting = artifacts.require('VotingMock')
const VotingReward = artifacts.require('VotingReward')
const Vault = artifacts.require('Vault')
const ExecutionTarget = artifacts.require('ExecutionTarget')
const { hash: nameHash } = require('eth-ens-namehash')

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = 100000
const MINIME_TOKEN_BALANCE = 100000
const ONE_HOURS = 3600
const ONE_DAY = 86400
const SUPPORT_REQUIRED_PCT = '510000000000000000' // 51%
const MIN_ACCEPTED_QUORUM_PCT = '510000000000000000' // 51%
const VOTE_TIME = ONE_DAY * 5 // a vote is open for 5 day
const EPOCH = ONE_DAY * 365

contract('VotingReward', ([appManager, ACCOUNTS_1, ...accounts]) => {
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
    CHANGE_MIN_SECONDS_THREESOLD,
    CHANGE_VAULT_ROLE,
    CHANGE_VOTING_ROLE,
    CREATE_VOTES_ROLE

  const NOT_CONTRACT = appManager

  before('deploy base apps', async () => {
    votingRewardBase = await VotingReward.new()
    CHANGE_MIN_SECONDS_THREESOLD = await votingRewardBase.CHANGE_MIN_SECONDS_THREESOLD()
    CHANGE_VAULT_ROLE = await votingRewardBase.CHANGE_VAULT_ROLE()
    CHANGE_VOTING_ROLE = await votingRewardBase.CHANGE_VOTING_ROLE()

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
        nameHash('vault.aragonpm.test'),
        baseVaultBase.address,
        appManager
      )
    )

    rewardsVault = await Vault.at(
      await newApp(
        dao,
        nameHash('vault2.aragonpm.test'),
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
    await voting.initialize(
      miniMeToken.address,
      SUPPORT_REQUIRED_PCT,
      MIN_ACCEPTED_QUORUM_PCT,
      VOTE_TIME
    )
    rewardsToken = await MockErc20.new(baseVault.address, MOCK_TOKEN_BALANCE)

    await miniMeToken.generateTokens(appManager, MINIME_TOKEN_BALANCE)
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold) fails', async () => {
    it('Should revert when passed non-contract address as baseVault', async () => {
      await assertRevert(
        votingReward.initialize(
          NOT_CONTRACT,
          rewardsVault.address,
          voting.address,
          ETH_ADDRESS,
          ONE_DAY
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
          ONE_DAY
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
          ONE_DAY
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
          ONE_DAY
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold)', () => {
    beforeEach(async () => {
      await votingReward.initialize(
        baseVault.address,
        rewardsVault.address,
        voting.address,
        rewardsToken.address,
        EPOCH
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
        CHANGE_MIN_SECONDS_THREESOLD,
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

      const actualBaseVault = await votingReward.baseVault()
      const actualRewardVault = await votingReward.rewardsVault()
      const actualVoting = await votingReward.voting()
      const epoch = parseInt(await votingReward.epoch())

      assert.strictEqual(actualBaseVault, rewardsVault.address)
      assert.strictEqual(actualRewardVault, baseVault.address)
      assert.strictEqual(actualVoting, baseVault.address)
      assert.strictEqual(epoch, EPOCH + ONE_DAY)
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

    describe('claimReward()', async () => {
      beforeEach(async () => {
        executionTarget = await ExecutionTarget.new()

        await setOpenPermission(
          acl,
          voting.address,
          CREATE_VOTES_ROLE,
          appManager
        )
      })

      it('Should fail because of not votes', async () => {
        await assertRevert(
          claim(votingReward, appManager),
          'VOTING_REWARD_VOTING_NO_VOTES'
        )
      })

      it('Should not be able to get a reward because an EPOCH since first vote is not passed', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_HOURS)
          await vote(voting, voteId, appManager)
        }

        await assertRevert(
          claim(votingReward, appManager, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should be able to get a reward after 1 EPOCH because it has voted to ALL proposals', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_HOURS)
          await vote(voting, voteId, appManager)
        }

        await timeTravel(EPOCH)
        const receipt = await claim(votingReward, appManager, appManager)
        const beneficiary = getEventArgument(
          receipt,
          'RewardDistributed',
          'beneficiary'
        )
        const amount = getEventArgument(receipt, 'RewardDistributed', 'amount')

        assert.strictEqual(beneficiary, appManager)
        // TODO: change reward
        assert.strictEqual(parseInt(amount), 10)
      })

      it('Should be able to get a reward after 1 EPOCH because it has voted to ALL - 1 proposals', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_HOURS)
          await vote(voting, voteId, appManager)
        }

        await newVote(
          voting,
          executionTarget.address,
          executionTarget.contract.methods.execute().encodeABI(),
          appManager
        )

        await timeTravel(EPOCH)
        const receipt = await claim(votingReward, appManager, appManager)
        const beneficiary = getEventArgument(
          receipt,
          'RewardDistributed',
          'beneficiary'
        )
        const amount = getEventArgument(receipt, 'RewardDistributed', 'amount')

        assert.strictEqual(beneficiary, appManager)
        // TODO: change reward
        assert.strictEqual(parseInt(amount), 10)
      })

      it('Should not be able to get a reward after 1 EPOCH because it has not voted to at least ALL - 1 proposals', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_HOURS)

          if (voteId % 2 === 0) {
            await vote(voting, voteId, appManager)
          }
        }

        await timeTravel(EPOCH)
        await assertRevert(
          claim(votingReward, appManager, appManager),
          'VOTING_REWARD_TOO_MUCH_MISSING_VOTES'
        )
      })

      it('Should not be able to get a double reward for 1 EPOCH', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_HOURS)
          await vote(voting, voteId, appManager)
        }

        await timeTravel(EPOCH)
        await claim(votingReward, appManager, appManager)

        await assertRevert(
          claim(votingReward, appManager, appManager),
          'VOTING_REWARD_ERROR_EPOCH'
        )
      })

      it('Should be able to get a reward after X EPOCHS because it voted to ALL - X proposals', async () => {
        const numVotes = 10
        const epochs = 10
        for (let epoch = 0; epoch < epochs; epoch++) {
          for (let voteId = 0; voteId < numVotes; voteId++) {
            await newVote(
              voting,
              executionTarget.address,
              executionTarget.contract.methods.execute().encodeABI(),
              appManager
            )

            await timeTravel(ONE_HOURS)
            if (voteId !== numVotes - 1) {
              await vote(voting, voteId + epoch * numVotes, appManager)
            }
          }
          await timeTravel(EPOCH)
        }

        const receipt = await claim(votingReward, appManager, appManager)
        const beneficiary = getEventArgument(
          receipt,
          'RewardDistributed',
          'beneficiary'
        )
        const amount = getEventArgument(receipt, 'RewardDistributed', 'amount')

        assert.strictEqual(beneficiary, appManager)
        // TODO: change reward
        assert.strictEqual(parseInt(amount), 10)
      })

      it('Should not be able to get a reward after X EPOCHS because it did not voted to at least ALL - X proposals', async () => {
        const numVotes = 10
        const epochs = 10
        for (let epoch = 0; epoch < epochs; epoch++) {
          for (let voteId = 0; voteId < numVotes; voteId++) {
            await newVote(
              voting,
              executionTarget.address,
              executionTarget.contract.methods.execute().encodeABI(),
              appManager
            )

            await timeTravel(ONE_HOURS)
            if (voteId < numVotes / 2) {
              await vote(voting, voteId + epoch * numVotes, appManager)
            }
          }
          await timeTravel(EPOCH)
        }

        await assertRevert(
          claim(votingReward, appManager, appManager),
          'VOTING_REWARD_TOO_MUCH_MISSING_VOTES'
        )
      })
    })
  })
})
