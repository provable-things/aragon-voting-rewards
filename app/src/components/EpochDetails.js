import React, { useState, useEffect } from 'react'
import { Box, ProgressBar, useTheme, GU } from '@aragon/ui'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { parseSeconds } from '../utils/time-utils'
import { findMinimunBalanceInRewardsForEpoch } from '../utils/rewards-utils'
import { toBN } from 'web3-utils'
import { strip } from '../utils/amount-utils'

const EpochDetails = (_props) => {
  const { rewardsToken, votes, rewards, epoch } = _props

  const theme = useTheme()

  const [epochRemainder, setEpochRemainder] = useState('-')
  const [epochTermination, setEpochTermination] = useState('-')
  const [current, setCurrent] = useState('-')
  const [duration, setDuration] = useState('-')
  const [lockTime, setLockTime] = useState('-')
  const [partecipateWith, setPartecipateWith] = useState('-')
  const [reward, setReward] = useState('-')
  const [percentageReward, setPercentageReward] = useState('-')
  const [status, setStatus] = useState('-')

  useEffect(() => {
    if (!epoch) return

    epoch.current || epoch.current === 0
      ? setCurrent(epoch.current)
      : setCurrent('-')
    epoch.lockTime || epoch.lockTime === 0
      ? setLockTime(parseSeconds(epoch.lockTime))
      : setLockTime('-')

    epoch.duration || epoch.duration === 0
      ? setDuration(parseSeconds(epoch.duration))
      : setDuration('-')

    epoch.percentageReward || epoch.percentageReward === 0
      ? setPercentageReward(`${epoch.percentageReward * 100}%`)
      : setPercentageReward('-')

    if (epoch.startBlock && epoch.duration) {
      setEpochTermination(
        new Date((epoch.startDate + epoch.duration) * 1000).toLocaleString()
      )
      setEpochRemainder(
        parseSeconds(
          ((epoch.startDate + epoch.duration) * 1000 - new Date().getTime()) /
            1000
        )
      )
    }
    if (epoch.duration && epoch.startDate) {
      const ends = (epoch.startDate + epoch.duration) * 1000
      setStatus(((ends - new Date().getTime()) / ends) * 100)
    }
  }, [epoch])

  useEffect(() => {
    if (!epoch) return

    const rt = [
      {
        amount: toBN(100000),
        lockBlock: 1,
        state: 0,
      },
      {
        amount: toBN(10000000),
        lockBlock: 1,
        state: 0,
      },
      {
        amount: toBN(200333000000),
        lockBlock: 345667,
        state: 0,
      },
      {
        amount: toBN(20000000),
        lockBlock: 345667,
        state: 0,
      },
      {
        amount: toBN(2000100000),
        lockBlock: 345667,
        state: 0,
      },
    ]

    const minimun = findMinimunBalanceInRewardsForEpoch(rt, epoch.startBlock)
    setPartecipateWith(strip(minimun.toString()))

    setReward(strip(parseInt(minimun.toString()) * epoch.percentageReward))
  }, [rewards])

  return (
    <Box
      heading={`EPOCH DETAILS`}
      css={`
        height: 100%;
      `}
    >
      <Detail>
        <DetailText>Epoch:</DetailText>
        <DetailValue>{current}</DetailValue>
      </Detail>
      <Detail>
        <DetailText>Duration:</DetailText>
        <DetailValue>{duration}</DetailValue>
      </Detail>
      <Detail>
        <DetailText>Ends the day:</DetailText>
        <DetailValue>{epochTermination}</DetailValue>
      </Detail>
      <Detail>
        <DetailText>Partecipate with:</DetailText>
        <DetailValue>
          {partecipateWith}
          <TokenSymbol
            css={`
              color: ${theme.info};
            `}
          >
            {` PNT`}
          </TokenSymbol>
        </DetailValue>
      </Detail>
      <Detail>
        <DetailText>Percentage reward:</DetailText>
        <DetailValue>{percentageReward}</DetailValue>
      </Detail>
      <Detail>
        <DetailText>Estimated reward:</DetailText>
        <DetailValue>
          {reward}
          <TokenSymbol
            css={`
              color: ${theme.info};
            `}
          >
            {` PNT`}
          </TokenSymbol>
        </DetailValue>
      </Detail>
      <Detail>
        <DetailText>Rewards locked for: </DetailText>
        <DetailValue>{lockTime}</DetailValue>
      </Detail>
      <Detail css={``}>
        <DetailText>Ends in:</DetailText>
        <DetailValue>{epochRemainder}</DetailValue>
      </Detail>
      <ProgressBar value={status} />
    </Box>
  )
}

const TokenSymbol = styled.span`
  font-weight: bold;
`

const DetailText = styled.span`
  float: left;
`

const DetailValue = styled.span`
  float: right;
  font-weight: bold;
`

const Detail = styled.div`
  margin-top: ${3 * GU}px;
  margin-bottom: ${2 * GU}px;
  display: flex;
  justify-content: space-between;
`

EpochDetails.propTypes = {
  rewardsToken: PropTypes.object,
  rewards: PropTypes.array,
  votes: PropTypes.array,
  epoch: PropTypes.object,
}

export default EpochDetails
