import { toBN } from 'web3-utils'
import { offChainFormat } from './utils/amount-utils'

const BLOCK_TIME = 15

const reducer = (_state) => {
  if (_state === null) {
    return {
      account: null,
      settings: null,
      voting: null,
      baseVault: null,
      rewardsVault: null,
      rewardToken: null,
      votingToken: null,
      epoch: null,
      rewards: [],
      votes: [],
    }
  }

  const { votes, epoch, rewards, rewardToken, votingToken } = _state

  return {
    ..._state,
    epoch: epoch
      ? {
          ...epoch,
          duration: epoch.duration
            ? parseInt(epoch.duration) * BLOCK_TIME
            : null,
          durationBlock: parseInt(epoch.duration),
          current: epoch.current ? parseInt(epoch.current) : null,
          startBlock: epoch.startBlock ? parseInt(epoch.startBlock) : null,
          lockTime: epoch.lockTime
            ? parseInt(epoch.lockTime) * BLOCK_TIME
            : null,
          percentageReward: parseInt(epoch.percentageReward) / Math.pow(10, 16),
          missingVotesThreshold: parseInt(epoch.missingVotesThreshold),
        }
      : null,
    votes: votes
      ? votes.map((_vote) => {
          return {
            ..._vote,
            executed: _vote.executed,
            open: _vote.open,
            script: _vote.script,
            snapshotBlock: parseInt(_vote.snapshotBlock),
            startDate: parseInt(_vote.startDate),
            minAcceptQuorum: parseInt(_vote.minAcceptQuorum, 10) / 18,
            nay: offChainFormat(toBN(_vote.nay), rewardToken.decimals),
            yea: offChainFormat(toBN(_vote.yea), rewardToken.decimals),
            votingPower: offChainFormat(
              toBN(_vote.votingPower),
              rewardToken.decimals
            ),
            supportRequired: parseInt(_vote.supportRequired, 10) / 18,
            state: parseInt(_vote.state),
            balance: offChainFormat(toBN(_vote.balance), votingToken.decimals),
          }
        })
      : [],
    rewards: rewards
      ? rewards.map((_reward) => {
          return {
            ..._reward,
            amount: offChainFormat(toBN(_reward.amount), rewardToken.decimals),
            // lockTime is expressed in blocks
            lockTime: parseInt(lockTime * BLOCK_TIME),
          }
        })
      : [],
  }
}

export default reducer
