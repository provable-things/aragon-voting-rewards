const jsonrpc = '2.0'
const id = 0

const send = (method, params = []) =>
  new Promise((resolve, reject) => {
    web3.currentProvider.send({ id, jsonrpc, method, params }, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })

const timeTravel = async (seconds) => {
  await send('evm_increaseTime', [seconds])
  await send('evm_mine')
}

const now = () =>
  new Promise((_resolve, _reject) => {
    web3.eth
      .getBlock('latest')
      .then(({ timestamp }) => _resolve(timestamp))
      .catch(_reject)
  })

module.exports = {
  timeTravel,
  now,
}
