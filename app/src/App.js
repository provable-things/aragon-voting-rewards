import React, { Fragment } from 'react'
import { useAppLogic } from './hooks'
import { Button, Header, Main, SyncIndicator } from '@aragon/ui'
import { useGuiStyle } from '@aragon/api-react'
import { Row, Col } from 'react-bootstrap'
import EpochDetails from './components/EpochDetails'
import Rewards from './components/Rewards'

const App = () => {
  const { isSyncing, actions, account } = useAppLogic()

  const { appearance } = useGuiStyle()

  const handleClick = (_e) => {
    actions.collect(account)
  }

  return (
    <Main theme={appearance}>
      {isSyncing ? (
        <SyncIndicator />
      ) : (
        <Fragment>
          <Header
            primary="Voting Reward"
            secondary={
              <React.Fragment>
                <Button
                  mode="strong"
                  label={'Get Rewards'}
                  onClick={handleClick}
                />
              </React.Fragment>
            }
          />
          <Row>
            <Col xs={12} xl={8}>
              <EpochDetails />
            </Col>
            <Col xs={12} xl={4} className="mt-3 mt-xl-0">
              <Rewards />
            </Col>
          </Row>
        </Fragment>
      )}
    </Main>
  )
}

export default App
