const { encodeCallScript } = require('@aragon/test-helpers/evmScript')

const newVote = (_voting, _to, _callData, _from) => {
  const action = { to: _to, calldata: _callData }
  const script = encodeCallScript([action])
  return _voting.newVoteExt(script, '', false, { from: _from })
}

// NOTE: _supports and _executesIfDecided hardcoded to true as they don't matter in this case
const vote = (_voting, _voteId, _from) =>
  _voting.vote(_voteId, true, {
    from: _from,
  })

const distributeRewardsForAll = async (
  _votingReward,
  _beneficiaries,
  _appManager,
  _interval = 10
) => {
  const chunksLength = Math.floor(_beneficiaries.length / _interval)
  const remainder = _beneficiaries.length % _interval

  for (let chunk = 0; chunk < chunksLength; chunk++) {
    const from = chunk * _interval
    const to = chunk * _interval + _interval

    await _votingReward.distributeRewardsForAll(
      _beneficiaries.slice(from, to),
      {
        from: _appManager,
        gas: 9500000,
      }
    )
  }

  await _votingReward.distributeRewardsForAll(
    _beneficiaries.slice(
      _beneficiaries.length - remainder,
      _beneficiaries.length
    ),
    {
      from: _appManager,
      gas: 9500000,
    }
  )
}

const collectRewardsForAll = async (
  _votingReward,
  _beneficiaries,
  _appManager,
  _interval = 10
) => {
  const chunksLength = Math.floor(_beneficiaries.length / _interval)
  const remainder = _beneficiaries.length % _interval

  for (let chunk = 0; chunk < chunksLength; chunk++) {
    const from = chunk * _interval
    const to = chunk * _interval + _interval

    await _votingReward.collectRewardsForAll(_beneficiaries.slice(from, to), {
      from: _appManager,
      gas: 9500000,
    })
  }

  await _votingReward.collectRewardsForAll(
    _beneficiaries.slice(
      _beneficiaries.length - remainder,
      _beneficiaries.length
    ),
    {
      from: _appManager,
      gas: 9500000,
    }
  )
}

const distributeRewardsFor = (_votingReward, _beneficiary, _appManager) =>
  _votingReward.distributeRewardsFor(_beneficiary, {
    from: _appManager,
  })

const openDistributionForEpoch = (_votingReward, _startFrom, _appManager) =>
  _votingReward.openDistributionForEpoch(_startFrom, {
    from: _appManager,
  })

const closeDistributionForCurrentEpoch = (_votingReward, _appManager) =>
  _votingReward.closeDistributionForCurrentEpoch({
    from: _appManager,
  })

const getAccountsBalance = async (_accounts, _token) => {
  const balances = new Map()
  for (let account of _accounts) {
    balances[account] = (await _token.balanceOf(account)).toString()
  }
  return balances
}

const getTotalReward = async (
  _accounts,
  _token,
  _percentageReward,
  _base = 10 ** 18
) => {
  let total = 0
  for (let account of _accounts) {
    total += Math.round(
      ((await _token.balanceOf(account)) * _percentageReward) / _base
    )
  }
  return total
}

module.exports = {
  collectRewardsForAll,
  newVote,
  vote,
  openDistributionForEpoch,
  closeDistributionForCurrentEpoch,
  distributeRewardsFor,
  getAccountsBalance,
  getTotalReward,
  distributeRewardsForAll,
}
