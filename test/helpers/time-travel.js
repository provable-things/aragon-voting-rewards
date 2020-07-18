const jsonrpc = '2.0'
const id = 0

const send = (method, params = [], id) =>
  new Promise((resolve, reject) => {
    web3.currentProvider.send({ id, jsonrpc, method, params }, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })

const timeTravel = async (seconds) => {
  await send('evm_increaseTime', [seconds])
  await send('evm_mine')
}

const mineBlocks = async (_numberOfBlocks) => {
  for (let i = 0; i < _numberOfBlocks; i++) await send('evm_mine')
}

const now = () =>
  new Promise((_resolve, _reject) => {
    web3.eth
      .getBlock('latest')
      .then(({ number }) => _resolve(number))
      .catch(_reject)
  })

module.exports = {
  timeTravel,
  now,
  mineBlocks,
}
