import React, { Fragment } from 'react'
import { useAppLogic } from './hooks'
import { Button, Header, Main, SyncIndicator } from '@aragon/ui'
import { useGuiStyle, useAppState } from '@aragon/api-react'
import { Row, Col } from 'react-bootstrap'
import EpochDetails from './components/EpochDetails'
import Rewards from './components/Rewards'
import { useRewards } from './hooks/rewards'

const App = () => {
  const { actions } = useAppLogic()
  const { isSyncing } = useAppState()
  const { appearance } = useGuiStyle()
  const { formattedTotalWithdrawable } = useRewards()

  const handleClick = (_e) => {
    actions.collect()
  }

  return (
    <Main theme={appearance}>
      {isSyncing ? (
        <SyncIndicator />
      ) : (
        <Fragment>
          <Header
            primary="Voting Rewards"
            secondary={
              <React.Fragment>
                <Button
                  mode="strong"
                  label={`Collect all rewards${formattedTotalWithdrawable ? ` (${formattedTotalWithdrawable})` : ''}`}
                  onClick={handleClick}
                />
              </React.Fragment>
            }
          />
          <Row>
            <Col xs={12}>
              <EpochDetails />
            </Col>
            <Col xs={12} className="mt-3">
              <Rewards />
            </Col>
          </Row>
        </Fragment>
      )}
    </Main>
  )
}

export default App
