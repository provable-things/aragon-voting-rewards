import { offChainFormat } from '../utils/amount-utils'

const UNLOCKED = 0
const WITHDRAWN = 1
const ABSENT = 0

const findMinimunBalanceInVotesForEpoch = (
  _votes,
  _from,
  _to,
  _decimals,
  _currentBalance
) => {
  let min = _currentBalance

  _votes.forEach((_vote, id) => {
    if (_vote.startBlock >= _from && _vote.startBlock <= _to) {
      if (!min) min = _vote.balance

      if (min.isLessThan(_vote.balance)) {
        min = _vote.balance
      }
    }
  })

  // should be safe since is already converted in offchain format
  return !min ? 0 : offChainFormat(min, _decimals).toNumber()
}

const getElegibilityOnEpoch = (
  _votes,
  _from,
  _to,
  _missingVotesThreshold,
  _voteDurationBlocks
) => {
  if (_votes.length === 0)
    return { isElegible: false, missing: 0, votesInEpoch: [] }

  let votedAt = 0
  const votesInEpoch = []
  _votes.forEach((_vote, id) => {
    if (
      _vote.startBlock + _voteDurationBlocks >= _from &&
      _vote.startBlock + _voteDurationBlocks <= _to
    ) {
      if (_vote.state !== ABSENT) {
        votedAt += 1
      }
      votesInEpoch.push({
        ..._vote,
        id: id + 1,
      })
    }
  })

  return {
    isElegible:
      votedAt >= _votes.length - _missingVotesThreshold ? true : false,
    missingVotes: _votes.length - votedAt,
    votesInEpoch,
  }
}

export {
  findMinimunBalanceInVotesForEpoch,
  getElegibilityOnEpoch,
  UNLOCKED,
  WITHDRAWN,
}
