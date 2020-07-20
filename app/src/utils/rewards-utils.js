const LOCKED = 0
const DISTRIBUTED = 1

const findMinimunBalanceInRewardsForEpoch = (_rewards, _startBlock) => {
  const filtered = _rewards.filter(
    ({ state, lockBlock }) => state == LOCKED && lockBlock >= _startBlock
  )

  if (filtered.length === 0) return null

  return filtered.reduce(
    (_min, _reward) =>
      _min.cmp(_reward.amount) === -1 ? _min : _reward.amount,
    filtered[0].amount
  )
}

export { findMinimunBalanceInRewardsForEpoch }
