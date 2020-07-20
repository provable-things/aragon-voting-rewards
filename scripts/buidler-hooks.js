const ETH_ADDRESS = '0x0000000000000000000000000000000000000000'
const MOCK_TOKEN_BALANCE = '10000000000000000000000000'
const MOCK_TOKEN_DECIMALS = 18
const ONE_DAY_BLOCKS = 86400 / 15
const EPOCH_BLOCKS = 50 // 1 minutes
const PERCENTAGE_REWARD = '4200000000000000'
const LOCK_TIME = ONE_DAY_BLOCKS * 365
const MISSING_VOTES_THREESHOLD = 1
const DURATION_BLOCKS = 2
const BUFFER_BLOCKS = 5

let accounts
let voting, baseVault, rewardsVault, tokenManager

module.exports = {
  preDao: async ({}, { web3, artifacts }) => {
    accounts = await web3.eth.getAccounts()
    appManager = accounts[0]
  },

  postDao: async ({ dao }, { web3, artifacts }) => {
    const ACL = artifacts.require('@aragon/os/build/contracts/acl/ACL')
    acl = await ACL.at(await dao.acl())
  },

  preInit: async (
    { proxy, _experimentalAppInstaller, log },
    { web3, artifacts }
  ) => {
    const MiniMeToken = artifacts.require('MiniMeToken')
    const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
    const ERC20 = artifacts.require('StandardToken')

    const miniMeTokenFactory = await MiniMeTokenFactory.new()
    miniMeToken = await MiniMeToken.new(
      miniMeTokenFactory.address,
      ETH_ADDRESS,
      0,
      'DaoToken',
      18,
      'DAOT',
      true
    )
    await miniMeToken.generateTokens(appManager, 10000000)

    tokenManager = await _experimentalAppInstaller('token-manager', {
      skipInitialize: true,
    })

    voting = await _experimentalAppInstaller('dandelion-voting', {
      skipInitialize: true,
    })
    baseVault = await _experimentalAppInstaller('vault')
    rewardsVault = await _experimentalAppInstaller('vault')

    await miniMeToken.changeController(tokenManager.address)
    await tokenManager.initialize([miniMeToken.address, false, 0])
    await voting.initialize([
      miniMeToken.address,
      '510000000000000000', // 51%
      '510000000000000000', // 51%
      DURATION_BLOCKS,
      BUFFER_BLOCKS,
      0,
    ])

    rewardsToken = await ERC20.new(
      'Deposit Token',
      'DPT',
      MOCK_TOKEN_DECIMALS,
      MOCK_TOKEN_BALANCE
    )

    log(`Base Vault: ${baseVault.address}`)
    log(`Rewards Vault: ${rewardsVault.address}`)
    log(`MiniMeToken: ${miniMeToken.address}`)
    log(`Dandelion Voting: ${voting.address}`)
    log(`Rewards Token: ${rewardsToken.address}`)
    log(`TokenManager: ${tokenManager.address}`)
    log(`ERC20: ${rewardsToken.address}`)
    log(`${appManager} balance: ${await rewardsToken.balanceOf(appManager)}`)
  },

  postInit: async ({ proxy }, { web3, artifacts }) => {
    await voting.createPermission(
      'CREATE_VOTES_ROLE',
      '0xffffffffffffffffffffffffffffffffffffffff'
    )
    await tokenManager.createPermission('MINT_ROLE', proxy.address)
    await tokenManager.createPermission('BURN_ROLE', proxy.address)
    await baseVault.createPermission('TRANSFER_ROLE', proxy.address)
    await rewardsVault.createPermission('TRANSFER_ROLE', proxy.address)
  },

  getInitParams: async ({}, { web3, artifacts }) => {
    return [
      baseVault.address,
      rewardsVault.address,
      voting.address,
      rewardsToken.address,
      EPOCH_BLOCKS,
      PERCENTAGE_REWARD,
      LOCK_TIME,
      MISSING_VOTES_THREESHOLD,
    ]
  },

  postUpdate: async ({ proxy }, { web3, artifacts }) => {},
}
