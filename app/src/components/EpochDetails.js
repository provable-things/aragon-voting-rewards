import React, { useState, useEffect, Fragment } from 'react'
import { useAppState } from '@aragon/api-react'
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
import { useEpochDetails } from '../hooks/epoch-details'

const EpochDetails = (_props) => {
  const { rewardsToken, account } = useAppState()

  const theme = useTheme()

  const [details] = useEpochDetails()
  const {
    current,
    lockTime,
    duration,
    percentageRewards,
    epochTermination,
    epochRemainder,
    status,
    reward,
    partecipateWith,
    votesInEpoch,
  } = details

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
        <DetailValue>{percentageRewards}</DetailValue>
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
        <DetailValue>{epochRemainder}</DetailValue>
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
              <Fragment>
                {votesInEpoch.length === 0 ? <Tag>No Votes</Tag> : null}
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
              </Fragment>
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

export default EpochDetails
