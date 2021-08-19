import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, { events } from '@aragon/api'
import ERC20Abi from './abi/ERC20.json'
import VotingAbi from './abi/Voting.json'
import MinimeTokenAbi from './abi/MinimeToken.json'
import { first } from 'rxjs/operators'
import axios from 'axios'
import BigNumber from 'bignumber.js'

const app = new Aragon()

const retryEvery = async (callback, { initialRetryTimer = 1000, increaseFactor = 3, maxRetries = 3 } = {}) => {
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
      console.log(`Retrying in ${nextRetryTime}s... (attempt ${retryNum} of ${maxRetries})`)
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
          case 'RewardCollected':
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

      const votingContract = app.external(_initParams.dandelionVotingAddress, VotingAbi)
      const [votingTokenAddress, voteDurationBlocks] = await Promise.all([
        votingContract.token().toPromise(),
        votingContract.durationBlocks().toPromise(),
      ])

      const votingToken = await getTokenData(votingTokenAddress)

      const [epoch, pctBase, currentBlock, currentTimestampBlock] = await Promise.all([
        getEpochData(),
        app.call('PCT_BASE').toPromise(),
        getCurrentBlockNumber(),
        getBlockTimestamp('latest'),
      ])

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
    const { account, rewardsToken } = _nextState
    if (account) {
      const [unlockedRewards, unlockedRewardsEvents] = await Promise.all([
        getUnlockedRewardsInfo(account),
        getUnlockedRewardsInfoEvents(account, rewardsToken.decimals),
      ])

      return {
        ..._nextState,
        unlockedRewards: [...unlockedRewards, ...unlockedRewardsEvents],
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

      const [
        votes,
        unlockedRewards,
        unlockedRewardsEvents,
        rewardsTokenBalance,
        votingTokenBalance,
      ] = await Promise.all([
        getVotes(dandelionVotingAddress, votingToken.address, account),
        getUnlockedRewardsInfo(account),
        getUnlockedRewardsInfoEvents(account, rewardsToken.decimals),
        getTokenBalance(rewardsToken.address, rewardsToken.decimals, account),
        getTokenBalance(votingToken.address, votingToken.decimals, account),
      ])

      return {
        ..._nextState,
        account,
        votes,
        unlockedRewards: [...unlockedRewards, ...unlockedRewardsEvents],
        rewardsTokenBalance,
        votingTokenBalance,
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
    const [decimals, name, symbol] = await Promise.all([
      token.decimals().toPromise(),
      token.name().toPromise(),
      token.symbol().toPromise(),
    ])

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
    const lastRewardsDistributionBlock = await app.call('lastRewardsDistributionBlock').toPromise()

    const [startDate, durationBlock, current, lockTime, percentageRewards, missingVotesThreshold] = await Promise.all([
      getBlockTimestamp(lastRewardsDistributionBlock),
      app.call('epochDuration').toPromise(),
      app.call('currentEpoch').toPromise(),
      app.call('lockTime').toPromise(),
      app.call('percentageRewards').toPromise(),
      app.call('missingVotesThreshold').toPromise(),
    ])

    return {
      startBlock: lastRewardsDistributionBlock,
      startDate,
      durationBlock,
      current,
      lockTime,
      percentageRewards,
      missingVotesThreshold,
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
    const rewards = await app.call('getUnlockedRewardsInfo', _receiver).toPromise()
    for (let reward of rewards) {
      reward.lockDate = await getBlockTimestamp(reward.lockBlock)
    }

    return rewards
  } catch (_err) {
    console.error(`Failed to load rewards: ${_err.message}`)
    return []
  }
}

const getUnlockedRewardsInfoEvents = async (_beneficiary, _decimals) => {
  try {
    const {
      data: { uncollected = [] },
    } = await axios.get(`https://eidoo.id/api/v1/get_rewards_info_2?ethAddress=${_beneficiary.toLowerCase()}`)
    return uncollected.map(({ amount, lockStartTime, lockStartBlock, lockEndBlock }) => ({
      amount: BigNumber(amount)
        .multipliedBy(10 ** _decimals)
        .toFixed(),
      lockBlock: lockStartBlock,
      lockTime: lockEndBlock - lockStartBlock,
      lockDate: lockStartTime,
    }))
  } catch (_err) {
    console.error(`Failed to load rewards (with events): ${_err.message}`)
    return []
  }
}

const getVotes = async (_votingContractAddress, _votingTokenAddress, _account) => {
  try {
    const votingContract = app.external(_votingContractAddress, VotingAbi)
    const votes = []
    for (let voteId = 1; voteId <= (await votingContract.votesLength().toPromise()); voteId++) {
      votes.push(await getVote(_account, voteId, _votingContractAddress, _votingTokenAddress))
    }
    return votes
  } catch (_err) {
    console.error(`Failed to load votes: ${_err.message}`)
    return []
  }
}

const getVote = async (_account, _voteId, _votingContractAddress, _votingTokenAddress) => {
  try {
    const votingContract = app.external(_votingContractAddress, VotingAbi)

    const vote = await votingContract.getVote(_voteId).toPromise()
    const state = await votingContract.getVoterState(_voteId, _account).toPromise()

    const votingTokenContract = app.external(_votingTokenAddress, MinimeTokenAbi)
    const balance = await votingTokenContract.balanceOfAt(_account, vote.startBlock).toPromise()

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
    const { timestamp } = await app.web3Eth('getBlock', _blockNumber).toPromise()
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
