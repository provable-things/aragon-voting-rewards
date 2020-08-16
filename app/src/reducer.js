import { UNLOCKED, WITHDRAWN } from './utils/rewards-utils'
import BigNumber from 'bignumber.js'

const BLOCK_TIMES = {
  main: 13,
  kovan: 4,
  rinkeby: 14,
  ropsten: 11,
  goerly: 15,
  private: 3,
}

const reducer = (_state) => {
  if (_state === null) {
    return {
      account: null,
      settings: null,
      dandelionVoting: null,
      baseVault: null,
      rewardsVault: null,
      rewardsToken: null,
      votingToken: null,
      epoch: null,
      rewards: [],
      votes: [],
      unlockedRewards: [],
      withdrawnRewards: [],
    }
  }

  const { votes, epoch, unlockedRewards, withdrawnRewards, settings } = _state

  return {
    ..._state,
    settings: {
      ...settings,
      pctBase: parseInt(settings.pctBase),
      blockTime: BLOCK_TIMES[settings.network.type],
    },
    epoch: epoch
      ? {
          ...epoch,
          duration:
            parseInt(epoch.duration) * BLOCK_TIMES[settings.network.type],
          durationBlock: parseInt(epoch.duration),
          current: parseInt(epoch.current),
          startBlock: parseInt(epoch.startBlock),
          lockTime:
            parseInt(epoch.lockTime) * BLOCK_TIMES[settings.network.type],
          percentageRewards:
            parseInt(epoch.percentageRewards) / settings.pctBase,
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
            startBlock: parseInt(_vote.startBlock),
            minAcceptQuorum: parseInt(_vote.minAcceptQuorum, 10) / 18,
            nay: new BigNumber(_vote.nay),
            yea: new BigNumber(_vote.yea),
            votingPower: new BigNumber(_vote.votingPower),
            supportRequired: parseInt(_vote.supportRequired, 10) / 18,
            state: parseInt(_vote.state),
            balance: new BigNumber(_vote.balance),
          }
        })
      : [],
    rewards:
      unlockedRewards && withdrawnRewards
        ? [
            ...unlockedRewards
              .filter(
                ({ amount, lockTime, lockBlock }) =>
                  amount !== '0' && lockTime !== '0' && lockBlock !== '0'
              )
              .map((_reward) => {
                return {
                  ..._reward,
                  amount: new BigNumber(_reward.amount),
                  lockTime: parseInt(
                    _reward.lockTime * BLOCK_TIMES[settings.network.type]
                  ),
                  state: UNLOCKED,
                }
              }),
            ...withdrawnRewards.map((_reward) => {
              return {
                ..._reward,
                amount: new BigNumber(_reward.amount),
                lockTime: parseInt(
                  _reward.lockTime * BLOCK_TIMES[settings.network.type]
                ),
                state: WITHDRAWN,
              }
            }),
          ].sort((_r1, _r2) => _r1.lockDate - _r2.lockDate)
        : [],
  }
}

export default reducer
