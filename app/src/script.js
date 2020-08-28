import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, { events } from '@aragon/api'
import ERC20Abi from './abi/ERC20.json'
import VaultAbi from './abi/Vault.json'
import VotingAbi from './abi/Voting.json'
import MinimeTokenAbi from './abi/MinimeToken.json'
import { first } from 'rxjs/operators'

const app = new Aragon()

const retryEvery = async (
  callback,
  { initialRetryTimer = 1000, increaseFactor = 3, maxRetries = 3 } = {}
) => {
  const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time))

  let retryNum = 0
  const attempt = async (retryTimer = initialRetryTimer) => {
    try {
      return await callback()
    } catch (err) {
      if (retryNum === maxRetries) {
        throw err
      }
      ++retryNum

      const nextRetryTime = retryTimer * increaseFactor
      console.log(
        `Retrying in ${nextRetryTime}s... (attempt ${retryNum} of ${maxRetries})`
      )
      await sleep(nextRetryTime)
      return attempt(nextRetryTime)
    }
  }

  return attempt()
}

retryEvery(() =>
  app
    .call('baseVault')
    .toPromise()
    .then(preInitizialize)
    .catch((err) => {
      console.error('Could not start background script execution due to:', err)
      throw err
    })
)

async function preInitizialize(_baseVaultAddress) {
  const settings = {
    network: await app.network().pipe(first()).toPromise(),
  }
  const rewardsVaultAddress = await app.call('rewardsVault').toPromise()
  const dandelionVotingAddress = await app.call('dandelionVoting').toPromise()

  return initialize({
    baseVaultAddress: _baseVaultAddress,
    rewardsVaultAddress,
    dandelionVotingAddress,
    settings,
  })
}

async function initialize(_initParams) {
  return app.store(
    async (state, { event, returnValues }) => {
      const nextState = {
        ...state,
      }

      try {
        switch (event) {
          case events.ACCOUNTS_TRIGGER:
            return handleAccountChange(nextState, returnValues)
          case events.SYNC_STATUS_SYNCING:
            return { ...nextState, isSyncing: true }
          case events.SYNC_STATUS_SYNCED:
            return { ...nextState, isSyncing: false }
          case 'RewardDistributed':
            return handleEvent(nextState)
          default:
            return nextState
        }
      } catch (_err) {
        console.error(`Failed to create store: ${_err.message}`)
      }
    },
    {
      init: initializeState(_initParams),
    }
  )
}

function initializeState(_initParams) {
  return async (_cachedState) => {
    try {
      const { settings } = _initParams
      const rewardsTokenAddress = await app.call('rewardsToken').toPromise()
      const rewardsToken = await getTokenData(rewardsTokenAddress)

      const votingContract = app.external(
        _initParams.dandelionVotingAddress,
        VotingAbi
      )
      const votingTokenAddress = await votingContract.token().toPromise()
      const voteDurationBlocks = await votingContract
        .durationBlocks()
        .toPromise()
      const votingToken = await getTokenData(votingTokenAddress)

      const epoch = await getEpochData()
      const pctBase = await app.call('PCT_BASE').toPromise()

      const currentBlock = await getCurrentBlockNumber()
      const currentTimestampBlock = await getBlockTimestamp('latest')

      return {
        ..._initParams,
        ..._cachedState,
        settings: {
          ...settings,
          pctBase,
          currentBlock,
          currentTimestampBlock,
        },
        rewardsToken,
        votingToken,
        voteDurationBlocks,
        epoch,
      }
    } catch (_err) {
      console.error(`Failed to initialize state: ${_err.message}`)
      return _cachedState
    }
  }
}

const handleEvent = async (_nextState) => {
  try {
    if (_nextState.account) {
      return {
        ..._nextState,
        unlockedRewards: await getUnlockedRewardsInfo(_nextState.account),
        withdrawnRewards: await getWithdrawnRewardsInfo(_nextState.account),
      }
    }

    return _nextState
  } catch (_err) {
    console.error(`Failed to handle event: ${_err.message}`)
    return _nextState
  }
}

const handleAccountChange = async (_nextState, { account }) => {
  try {
    if (account) {
      const { dandelionVotingAddress, votingToken, rewardsToken } = _nextState

      return {
        ..._nextState,
        account,
        votes: await getVotes(
          dandelionVotingAddress,
          votingToken.address,
          account
        ),
        unlockedRewards: await getUnlockedRewardsInfo(account),
        withdrawnRewards: await getWithdrawnRewardsInfo(account),
        rewardsTokenBalance: await getTokenBalance(
          rewardsToken.address,
          rewardsToken.decimals,
          account
        ),
      }
    }

    return _nextState
  } catch (_err) {
    console.error(`Failed to handle account change: ${_err.message}`)
    return _nextState
  }
}

const getTokenData = async (_tokenAddress) => {
  try {
    const token = app.external(_tokenAddress, ERC20Abi)
    const decimals = await token.decimals().toPromise()
    const name = await token.name().toPromise()
    const symbol = await token.symbol().toPromise()

    return {
      decimals,
      name,
      symbol,
      address: _tokenAddress,
    }
  } catch (_err) {
    console.error(`Failed to load token data: ${_err.message}`)
    // TODO find a way to get a fallback
    throw new Error(_err.message)
  }
}

const getEpochData = async () => {
  try {
    // a new epoch starts when the rewards of the last epoch ends
    const lastRewardsDistributionBlock = await app
      .call('lastRewardsDistributionBlock')
      .toPromise()

    return {
      startBlock: lastRewardsDistributionBlock,
      startDate: await getBlockTimestamp(lastRewardsDistributionBlock),
      durationBlock: await app.call('epochDuration').toPromise(),
      current: await app.call('currentEpoch').toPromise(),
      lockTime: await app.call('lockTime').toPromise(),
      percentageRewards: await app.call('percentageRewards').toPromise(),
      missingVotesThreshold: await app
        .call('missingVotesThreshold')
        .toPromise(),
    }
  } catch (_err) {
    console.error(`Failed to load epoch data: ${_err.message}`)
    return {
      startBlock: null,
      durationBlock: null,
      current: null,
      lockTime: null,
    }
  }
}

const getUnlockedRewardsInfo = async (_receiver) => {
  try {
    const rewards = await app
      .call('getUnlockedRewardsInfo', _receiver)
      .toPromise()

    for (let reward of rewards) {
      reward.lockDate = await getBlockTimestamp(reward.lockBlock)
    }

    return rewards
  } catch (_err) {
    console.error(`Failed to load rewards: ${_err.message}`)
    return []
  }
}

const getWithdrawnRewardsInfo = async (_receiver) => {
  try {
    const rewards = await app
      .call('getWithdrawnRewardsInfo', _receiver)
      .toPromise()

    for (let reward of rewards) {
      reward.lockDate = await getBlockTimestamp(reward.lockBlock)
    }

    return rewards
  } catch (_err) {
    console.error(`Failed to load rewards: ${_err.message}`)
    return []
  }
}

const getVotes = async (
  _votingContractAddress,
  _votingTokenAddress,
  _account
) => {
  try {
    const votingContract = app.external(_votingContractAddress, VotingAbi)
    const votes = []
    for (
      let voteId = 1;
      voteId <= (await votingContract.votesLength().toPromise());
      voteId++
    ) {
      votes.push(
        await getVote(
          _account,
          voteId,
          _votingContractAddress,
          _votingTokenAddress
        )
      )
    }
    return votes
  } catch (_err) {
    console.error(`Failed to load votes: ${_err.message}`)
    return []
  }
}

const getVote = async (
  _account,
  _voteId,
  _votingContractAddress,
  _votingTokenAddress
) => {
  try {
    const votingContract = app.external(_votingContractAddress, VotingAbi)

    const vote = await votingContract.getVote(_voteId).toPromise()
    const state = await votingContract
      .getVoterState(_voteId, _account)
      .toPromise()

    const votingTokenContract = app.external(
      _votingTokenAddress,
      MinimeTokenAbi
    )
    const balance = await votingTokenContract
      .balanceOfAt(_account, vote.startBlock)
      .toPromise()

    return {
      ...vote,
      balance,
      state,
    }
  } catch (_err) {
    console.error(`Failed to load single vote: ${_err.message}`)
    throw new Error(_err.message)
  }
}

const getBlockTimestamp = async (_blockNumber) => {
  try {
    const { timestamp } = await app
      .web3Eth('getBlock', _blockNumber)
      .toPromise()
    return timestamp
  } catch (_err) {
    console.error(`Failed to load block timestamp: ${_err.message}`)
    throw new Error(_err)
  }
}

const getCurrentBlockNumber = async () => {
  try {
    const { number } = await app.web3Eth('getBlock', 'latest').toPromise()
    return number
  } catch (_err) {
    console.error(`Failed to load block number: ${_err.message}`)
    throw new Error(_err)
  }
}

const getTokenBalance = (_tokenAddress, _tokenDecimals, _address) => {
  try {
    const token = app.external(_tokenAddress, ERC20Abi)
    return token.balanceOf(_address).toPromise()
  } catch (_err) {
    console.error(`Failed to load token balance: ${_err.message}`)
    throw new Error(_err.message)
  }
}
