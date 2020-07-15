# :moneybag: voting-reward

An Aragon app that allows to get rewards in base of how many votes you made in a certain amount of time.

&nbsp;

***

&nbsp;

## :clipboard: How to run locally

```
yarn install
```

```
yarn start
```

&nbsp;

***

&nbsp;

## :guardsman: Test

```
yarn test
```

### Result

```
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold) fails
      ✓ Should revert when passed non-contract address as baseVault (51ms)
      ✓ Should revert when passed non-contract address as rewardsVault
      ✓ Should revert when passed non-contract address as voting
      ✓ Should revert when passed non-contract address as deposit token
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold)
      ✓ Should set correct variables (40ms)
      ✓ Should set able to change baseVault, rewardsVault voting and minimun seconds (219ms)
      ✓ Should not be able to set epoch because of no permission (43ms)
      ✓ Should not be able to set a new Base Vault because of no permission (47ms)
      ✓ Should not be able to set a new Reward Vault because of no permission (38ms)
      ✓ Should not be able to set a new Voting because of no permission
      claimReward()
        ✓ Should fail because of not votes
        ✓ Should not be able to get a reward because an EPOCH since first vote is not passed (535ms)
        ✓ Should be able to get a reward after 1 EPOCH because it has voted to ALL proposals (623ms)
        ✓ Should be able to get a reward after 1 EPOCH because it has voted to ALL - 1 proposals (653ms)
        ✓ Should not be able to get a reward after 1 EPOCH because it has not voted to at least ALL - 1 proposals (464ms)
        ✓ Should not be able to get a double reward for 1 EPOCH (727ms)
        ✓ Should be able to get a reward after X EPOCHS because it voted to ALL - X proposals (6117ms)
        ✓ Should not be able to get a reward after X EPOCHS because it did not voted to at least ALL - X proposals (4461ms)


  18 passing (25s)
```

&nbsp;

***

&nbsp;

## :rocket: How to publish

Create an __`.env`__ file with the following format

```
PRIVATE_KEY=
INFURA_KEY=
```

Run the local IPFS node:

```
aragon ipfs start
```

and then publish.

```
npx buidler publish "version or patch/minor/major" --network "rinkeby or mainnet"
```