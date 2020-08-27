const PCT_BASE = Math.pow(10, 18)

const calculateReward = async (
  _beneficiary,
  _fromBlock,
  _toBlock,
  _votingToken,
  _voting,
  _voteDurationBlocks,
  _missingVotesThreshold,
  _percentageRewards
) => {
  let missingVotes = 0
  let minimumBalance = parseInt(
    await _votingToken.balanceOfAt(_beneficiary, _toBlock)
  )

  for (let voteId = await _voting.votesLength(); voteId >= 1; voteId--) {
    const vote = await _voting.getVote(voteId)
    const startBlock = parseInt(vote.startBlock)

    if (
      startBlock + _voteDurationBlocks >= _fromBlock &&
      startBlock + _voteDurationBlocks <= _toBlock
    ) {
      const votingTokenBalanceAtVote = parseInt(
        await _votingToken.balanceOfAt(_beneficiary, startBlock)
      )
      if (votingTokenBalanceAtVote === 0) {
        return 0
      }

      if (parseInt(await _voting.getVoterState(voteId, _beneficiary)) === 0) {
        missingVotes = missingVotes + 1
        if (missingVotes > _missingVotesThreshold) {
          return 0
        }
      }

      if (votingTokenBalanceAtVote < minimumBalance) {
        minimumBalance = votingTokenBalanceAtVote
      }
    }

    if (startBlock < _fromBlock) break
  }

  return minimumBalance > 0
    ? Math.round((minimumBalance * _percentageRewards) / PCT_BASE)
    : minimumBalance
}

const calculateRewards = async (
  _votingReward,
  _voting,
  _miniMeToken,
  _missingVotesThreshold,
  _percentageRewards,
  _accounts
) => {
  const epochStartAt = parseInt(
    await _votingReward.startBlockNumberOfCurrentEpoch()
  )
  const epochDuration = parseInt(await _votingReward.epochDuration())
  const voteDurationBlocks = parseInt(await _voting.durationBlocks())

  const rewards = []
  for (let account of _accounts) {
    rewards.push(
      await calculateReward(
        account,
        epochStartAt,
        epochStartAt + epochDuration,
        _miniMeToken,
        _voting,
        voteDurationBlocks,
        _missingVotesThreshold,
        _percentageRewards
      )
    )
  }

  return rewards
}

module.exports = {
  calculateReward,
  calculateRewards,
}
