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

const distributeRewardsToMany = async (_votingReward, _beneficiaries, _amounts, _appManager, _interval = 20) => {
  const chunksLength = Math.floor(_beneficiaries.length / _interval)
  const remainder = _beneficiaries.length % _interval

  const allLogs = []
  for (let chunk = 0; chunk < chunksLength; chunk++) {
    const from = chunk * _interval
    const to = chunk * _interval + _interval

    const {
      receipt: { logs },
    } = await _votingReward.distributeRewardsToMany(_beneficiaries.slice(from, to), _amounts.slice(from, to), {
      from: _appManager,
      gas: 9500000,
    })
    allLogs.push(...logs)
  }

  const {
    receipt: { logs },
  } = await _votingReward.distributeRewardsToMany(
    _beneficiaries.slice(_beneficiaries.length - remainder, _beneficiaries.length),
    _amounts.slice(_amounts.length - remainder, _amounts.length),
    {
      from: _appManager,
      gas: 9500000,
    }
  )
  allLogs.push(...logs)

  return allLogs
    .filter(({ event }) => event === 'RewardDistributed')
    .map(({ args, blockNumber }) => ({ ...args, lockBlock: blockNumber }))
}

const forceDistributeRewardsToMany = async (
  _votingReward,
  _beneficiaries,
  _amounts,
  _lockTime,
  _appManager,
  _interval = 20
) => {
  const chunksLength = Math.floor(_beneficiaries.length / _interval)
  const remainder = _beneficiaries.length % _interval

  const allLogs = []
  for (let chunk = 0; chunk < chunksLength; chunk++) {
    const from = chunk * _interval
    const to = chunk * _interval + _interval

    const {
      receipt: { logs },
    } = await _votingReward.forceDistributeRewardsToMany(
      _beneficiaries.slice(from, to),
      _amounts.slice(from, to),
      _lockTime,
      {
        from: _appManager,
        gas: 9500000,
      }
    )
    allLogs.push(...logs)
  }

  const {
    receipt: { logs },
  } = await _votingReward.forceDistributeRewardsToMany(
    _beneficiaries.slice(_beneficiaries.length - remainder, _beneficiaries.length),
    _amounts.slice(_amounts.length - remainder, _amounts.length),
    _lockTime,
    {
      from: _appManager,
      gas: 9500000,
    }
  )
  allLogs.push(...logs)

  return allLogs
    .filter(({ event }) => event === 'RewardDistributed')
    .map(({ args, blockNumber }) => ({ ...args, lockBlock: blockNumber }))
}

const collectRewardsForMany = async (_votingReward, _beneficiaries, _appManager, _interval = 10) => {
  const chunksLength = Math.floor(_beneficiaries.length / _interval)
  const remainder = _beneficiaries.length % _interval

  for (let chunk = 0; chunk < chunksLength; chunk++) {
    const from = chunk * _interval
    const to = chunk * _interval + _interval

    await _votingReward.collectRewardsForMany(_beneficiaries.slice(from, to), {
      from: _appManager,
      gas: 9500000,
    })
  }

  await _votingReward.collectRewardsForMany(
    _beneficiaries.slice(_beneficiaries.length - remainder, _beneficiaries.length),
    {
      from: _appManager,
      gas: 9500000,
    }
  )
}

const semiTrustedCollectRewardsForMany = async (
  _distributions,
  _currentBlock,
  _lockTime,
  _rewardsVault,
  _rewardsToken,
  _appManager
) => {
  const collectedRewards = _distributions.filter(
    ({ lockBlock, lockTime }) => parseInt(_currentBlock) - parseInt(lockBlock) > parseInt(lockTime)
  )
  await Promise.all(
    collectedRewards.map(
      ({ beneficiary, amount }) =>
        new Promise((_resolve) => {
          _rewardsVault.transfer(_rewardsToken, beneficiary, amount).then(_resolve)
        })
    )
  )

  return collectedRewards
}

const distributeRewardsTo = async (_votingReward, _beneficiary, _reward, _appManager) => {
  const {
    receipt: { logs },
  } = await _votingReward.distributeRewardsTo(_beneficiary, _reward, {
    from: _appManager,
  })

  return logs
    .filter(({ event }) => event === 'RewardDistributed')
    .map(({ args, blockNumber }) => ({ ...args, lockBlock: blockNumber }))
}

const forceDistributeRewardsTo = async (_votingReward, _beneficiary, _reward, _lockTime, _appManager) => {
  const {
    receipt: { logs },
  } = await _votingReward.forceDistributeRewardsTo(_beneficiary, _reward, _lockTime, {
    from: _appManager,
  })

  return logs
    .filter(({ event }) => event === 'RewardDistributed')
    .map(({ args, blockNumber }) => ({ ...args, lockBlock: blockNumber }))
}

const collectRewardsFor = (_votingReward, _beneficiary, _appManager) =>
  _votingReward.collectRewardsFor(_beneficiary, {
    from: _appManager,
  })

const forceCollectRewardsFor = (_votingReward, _beneficiary, _receiver, _appManager) =>
  _votingReward.forceCollectRewardsFor(_beneficiary, _receiver, {
    from: _appManager,
  })

const forceCollectRewardsForMany = (_votingReward, _beneficiaries, _receivers, _appManager) =>
  _votingReward.forceCollectRewardsForMany(_beneficiaries, _receivers, {
    from: _appManager,
  })

const openRewardsDistributionForEpoch = (_votingReward, _startFrom, _appManager) =>
  _votingReward.openRewardsDistributionForEpoch(_startFrom, {
    from: _appManager,
  })

const closeRewardsDistributionForCurrentEpoch = (_votingReward, _appManager) =>
  _votingReward.closeRewardsDistributionForCurrentEpoch({
    from: _appManager,
  })

const getAccountsBalance = async (_accounts, _token) => {
  const balances = new Map()
  for (let account of _accounts) {
    balances[account] = (await _token.balanceOf(account)).toString()
  }
  return balances
}

const getTotalReward = async (_accounts, _token, _percentageReward, _base = 10 ** 18) => {
  let total = 0
  for (let account of _accounts) {
    total += Math.round(((await _token.balanceOf(account)) * _percentageReward) / _base)
  }
  return total
}

module.exports = {
  collectRewardsForMany,
  newVote,
  vote,
  openRewardsDistributionForEpoch,
  closeRewardsDistributionForCurrentEpoch,
  distributeRewardsTo,
  getAccountsBalance,
  getTotalReward,
  distributeRewardsToMany,
  distributeRewardsTo,
  collectRewardsFor,
  semiTrustedCollectRewardsForMany,
  forceDistributeRewardsToMany,
  forceDistributeRewardsTo,
  forceCollectRewardsFor,
  forceCollectRewardsForMany,
}
