const { encodeCallScript } = require('@aragon/test-helpers/evmScript')

const newVote = (_voting, _to, _callData, _from) => {
  const action = { to: _to, calldata: _callData }
  const script = encodeCallScript([action])
  return _voting.newVoteExt(script, '', false, false, { from: _from })
}

// NOTE: _supports and _executesIfDecided hardcoded to true as they don't matter in this case
const vote = (_voting, _voteId, _from) =>
  _voting.vote(_voteId, true, true, {
    from: _from,
  })

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

const collectRewardsFor = (_votingReward, _beneficiary, _appManager) =>
  _votingReward.collectRewardsFor(_beneficiary, {
    from: _appManager,
  })

const openClaimForEpoch = (_votingReward, _startFrom, _appManager) =>
  _votingReward.openClaimForEpoch(_startFrom, {
    from: _appManager,
  })

const closeClaimForCurrentEpoch = (_votingReward, _appManager) =>
  _votingReward.closeClaimForCurrentEpoch({
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
  _numVotes
) => {
  let total = 0
  for (let account of _accounts) {
    total += ((await _token.balanceOf(account)) * _percentageReward) / 100
  }
  return total * _numVotes
}

module.exports = {
  collectRewardsForAll,
  newVote,
  vote,
  openClaimForEpoch,
  closeClaimForCurrentEpoch,
  collectRewardsFor,
  getAccountsBalance,
  getTotalReward,
  distributeRewardsForAll,
}
