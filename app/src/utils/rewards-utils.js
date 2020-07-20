const UNLOCKED = 0
const WITHDRAWN = 1
const ABSENT = 0

const findMinimunBalanceInRewardsForEpoch = (_rewards, _startBlock) => {
  const filtered = _rewards.filter(
    ({ state, lockBlock }) => state == UNLOCKED && lockBlock >= _startBlock
  )

  if (filtered.length === 0) return null

  return filtered.reduce(
    (_min, _reward) =>
      _min.cmp(_reward.amount) === -1 ? _min : _reward.amount,
    filtered[0].amount
  )
}

const getElegibilityOnEpoch = (_votes, _from, _to, _missingVotesThreeshold) => {
  if (_votes.length === 0)
    return { elegible: false, missing: 0, votesInEpoch: [] }

  let votedAt = 0
  const votesInEpoch = []
  for (let vote of _votes) {
    if (vote.snapshotBlock >= _from && vote.snapshotBlock <= _to) {
      votesInEpoch.push(vote)
      if (vote.state !== ABSENT) {
        votedAt += 1
      }
    }
  }

  return {
    eligible: votedAt >= _votes.length - _missingVotesThreeshold ? true : false,
    missingVotes: _votes.length - votedAt,
    votesInEpoch,
  }
}

export {
  findMinimunBalanceInRewardsForEpoch,
  getElegibilityOnEpoch,
  UNLOCKED,
  WITHDRAWN,
}
