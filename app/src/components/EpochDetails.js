import React, { useState, useEffect, Fragment } from 'react'
import {
  Box,
  ProgressBar,
  useTheme,
  GU,
  IconCheck,
  IconClock,
  IconClose,
} from '@aragon/ui'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { parseSeconds } from '../utils/time-utils'
import {
  findMinimunBalanceInRewardsForEpoch,
  getElegibilityOnEpoch,
} from '../utils/rewards-utils'
import { strip } from '../utils/amount-utils'

const EpochDetails = (_props) => {
  const { rewardsToken, votes, rewards, epoch, account } = _props

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
  const [eligibility, setEligibility] = useState('-')
  const [missingVotes, setMissingVotes] = useState('-')
  const [votesInEpoch, setvotesInEpoch] = useState([])

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
    }

    if (epoch.duration && epoch.startDate) {
      const start = epoch.startDate * 1000
      const end = (epoch.startDate + epoch.duration) * 1000
      const now = new Date().getTime()

      setEpochRemainder((end - now) / 1000)

      if (now > end) setStatus(1)

      setStatus(Math.round(((now - start) / (end - start)) * 100) / 100)
    }
  }, [epoch])

  useEffect(() => {
    if (!epoch) return

    const minimun = findMinimunBalanceInRewardsForEpoch(
      rewards,
      epoch.startBlock
    )
    if (!minimun) return

    setPartecipateWith(strip(minimun.toString()))
    setReward(strip(parseInt(minimun.toString()) * epoch.percentageReward))
  }, [rewards])

  useEffect(() => {
    if (!epoch) return

    const { eligible, missingVotes, votesInEpoch } = getElegibilityOnEpoch(
      votes,
      epoch.startBlock,
      epoch.durationBlock,
      epoch.missingVotesThreeshold
    )

    setEligibility(eligible)
    setMissingVotes(missingVotes)
    setvotesInEpoch(votesInEpoch)
  }, [votes])

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
        <DetailText>End date:</DetailText>
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
            {rewardsToken ? ` ${rewardsToken.symbol}` : '-'}
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
            {rewardsToken ? ` ${rewardsToken.symbol}` : '-'}
          </TokenSymbol>
        </DetailValue>
      </Detail>
      <Detail>
        <DetailText>Rewards locked for: </DetailText>
        <DetailValue>{lockTime}</DetailValue>
      </Detail>
      <Detail css={``}>
        <DetailText>Ends in:</DetailText>
        <DetailValue>
          {epochRemainder && epochRemainder > 0
            ? parseSeconds(epochRemainder)
            : 'Terminated'}
        </DetailValue>
      </Detail>
      <ProgressBar value={status} />
      {account ? (
        <Fragment>
          <Detail
            css={`
              margin-top: ${5 * GU}px;
            `}
          >
            <DetailText>Your participation to this epoch:</DetailText>
            <DetailValue>
              <IconCheck
                css={`
                  color: green;
                `}
              />
              <IconClose
                css={`
                  color: red;
                `}
              />
              <IconClock />
            </DetailValue>
          </Detail>
        </Fragment>
      ) : null}
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
  account: PropTypes.string,
}

export default EpochDetails
