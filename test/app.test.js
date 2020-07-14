const { assert } = require('chai')
const { assertRevert } = require('@aragon/contract-test-helpers/assertThrow')
const { newDao, newApp } = require('./helpers/dao')
const { setPermission, setOpenPermission } = require('./helpers/permissions')
const timeTravel = require('./helpers/time-travel')
const { getNewProxyAddress } = require('@aragon/test-helpers/events')
const { newVote, vote } = require('./helpers/utils')

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
const ONE_DAY = 86400
const SUPPORT_REQUIRED_PCT = '510000000000000000' // 51%
const MIN_ACCEPTED_QUORUM_PCT = '510000000000000000' // 51%
const VOTE_TIME = ONE_DAY * 5 // a vote is open for 5 day

contract('VotingReward', ([appManager, ACCOUNTS_1, ...accounts]) => {
  let miniMeToken,
    votingRewardBase,
    votingReward,
    voting,
    votingBase,
    rewardToken,
    vaultBase,
    vault,
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

    vaultBase = await Vault.new()
    TRANSFER_ROLE = await vaultBase.TRANSFER_ROLE()
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

    vault = await Vault.at(
      await newApp(
        dao,
        nameHash('vault.aragonpm.test'),
        vaultBase.address,
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

    await vault.initialize()
    await voting.initialize(
      miniMeToken.address,
      SUPPORT_REQUIRED_PCT,
      MIN_ACCEPTED_QUORUM_PCT,
      VOTE_TIME
    )

    rewardToken = await MockErc20.new(vault.address, MOCK_TOKEN_BALANCE)

    await miniMeToken.generateTokens(appManager, MINIME_TOKEN_BALANCE)
  })

  describe('initialize(address _vault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold) fails', async () => {
    it('Should revert when passed non-contract address as vault', async () => {
      await assertRevert(
        votingReward.initialize(
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
          vault.address,
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
          vault.address,
          voting.address,
          NOT_CONTRACT,
          ONE_DAY
        ),
        'VOTING_REWARD_ADDRESS_NOT_CONTRACT'
      )
    })
  })

  describe('initialize(address _vault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold)', () => {
    beforeEach(async () => {
      await votingReward.initialize(
        vault.address,
        voting.address,
        rewardToken.address,
        ONE_DAY
      )
    })

    /*it('Should set correct variables', async () => {
      const actualVoting = await votingReward.voting()
      const actualVault = await votingReward.vault()
      const actualRewardToken = await votingReward.rewardToken()

      assert.strictEqual(actualVoting, voting.address)
      assert.strictEqual(actualVault, vault.address)
      assert.strictEqual(actualRewardToken, rewardToken.address)
    })

    it('Should set able to change vault, voting and minimun seconds', async () => {
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

      await votingReward.changeMinSecondsThreeshold(ONE_DAY * 7, {
        from: appManager,
      })

      // NOTE: only for this test
      await votingReward.changeVault(voting.address, {
        from: appManager,
      })

      // NOTE: only for this test
      await votingReward.changeVoting(vault.address, {
        from: appManager,
      })

      const actualVault = await votingReward.vault()
      const actualVoting = await votingReward.voting()
      const minSecondsThreeshold = parseInt(await votingReward.minSecondsThreeshold())

      assert.strictEqual(actualVault, voting.address)
      assert.strictEqual(actualVoting, vault.address)
      assert.strictEqual(minSecondsThreeshold, ONE_DAY * 7)
    })

    it('Should not be able to set minSecondsThreeshold because of no permission', async () => {
      await assertRevert(
        votingReward.changeMinSecondsThreeshold(ONE_DAY * 7, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Vault because of no permission', async () => {
      await assertRevert(
        votingReward.changeVault(vault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })

    it('Should not be able to set a new Voting because of no permission', async () => {
      await assertRevert(
        votingReward.changeVoting(vault.address, {
          from: appManager,
        }),
        'APP_AUTH_FAILED'
      )
    })*/

    describe('claimRewards()', async () => {
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
          votingReward.claimRewards(),
          'VOTING_REWARD_VAULT_NO_VOTES'
        )
      })

      it('Should be able to get a reward', async () => {
        const numVotes = 10
        for (let voteId = 0; voteId < numVotes; voteId++) {
          await newVote(
            voting,
            executionTarget.address,
            executionTarget.contract.methods.execute().encodeABI(),
            appManager
          )

          await timeTravel(ONE_DAY)
          await vote(voting, voteId, appManager)
        }
      })
    })
  })
})
