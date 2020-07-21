import React, { useState, useEffect, Fragment } from 'react'
import {
  Box,
  ProgressBar,
  useTheme,
  GU,
  IconCheck,
  IconClock,
  IconClose,
  Tag,
} from '@aragon/ui'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { parseSeconds } from '../utils/time-utils'
import {
  findMinimunBalanceInVotesForEpoch,
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
  //const [missingVotes, setMissingVotes] = useState('-')
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

    const minimun = findMinimunBalanceInVotesForEpoch(
      votes,
      epoch.startBlock,
      epoch.startBlock + epoch.durationBlock
    )
    if (!minimun) return

    setPartecipateWith(strip(minimun.toString()))
    setReward(strip(parseInt(minimun.toString()) * epoch.percentageReward))
  }, [votes])

  useEffect(() => {
    if (!epoch) return

    const { eligible, /*missingVotes,*/ votesInEpoch } = getElegibilityOnEpoch(
      votes,
      epoch.startBlock,
      epoch.startBlock + epoch.durationBlock,
      epoch.missingVotesThreshold
    )

    setEligibility(eligible)
    //setMissingVotes(missingVotes)
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
              {votesInEpoch.map(({ state, id }, _index) => {
                return (
                  <Fragment key={_index}>
                    {state ? (
                      <Tag
                        mode="new"
                        css={`
                          margin-left: ${GU}px;
                        `}
                      >
                        <IconCheck
                          size="small"
                          css={`
                            color: green;
                            vertical-align: text-top;
                          `}
                        />
                        {`Vote #${id}`}
                      </Tag>
                    ) : !state && epochRemainder > 0 ? (
                      <Tag
                        mode="indicator"
                        css={`
                          margin-left: ${GU}px;
                        `}
                      >
                        <IconClock
                          size="small"
                          css={`
                            vertical-align: text-top;
                          `}
                        />
                        {`Vote ${id}`}
                      </Tag>
                    ) : (
                      <Tag
                        color="red"
                        css={`
                          margin-left: ${GU}px;
                          background: rgba(255, 102, 102, 0.35);
                        `}
                      >
                        <IconClose
                          size="small"
                          css={`
                            color: red;
                            vertical-align: text-top;
                          `}
                        />
                        {`Vote #${id}`}
                      </Tag>
                    )}
                  </Fragment>
                )
              })}
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
