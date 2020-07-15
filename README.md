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
      ✓ Should revert when passed non-contract address as baseVault (50ms)
      ✓ Should revert when passed non-contract address as rewardsVault
      ✓ Should revert when passed non-contract address as voting
      ✓ Should revert when passed non-contract address as deposit token
    initialize(address _baseVault, address _rewardsVault, address _voting, address _rewardToken, _uint64 _minSecondsThreeshold)
      ✓ Should set correct variables
      ✓ Should set able to change baseVault, rewardsVault voting and minimun seconds (226ms)
      ✓ Should not be able to set epoch because of no permission (42ms)
      ✓ Should not be able to set a new Base Vault because of no permission (47ms)
      ✓ Should not be able to set a new Reward Vault because of no permission
      ✓ Should not be able to set a new Voting because of no permission (38ms)
      claimReward()
        ✓ Should fail because of not votes
        ✓ Should not be able to get a reward because an EPOCH since first vote is not passed (580ms)
        ✓ Should be able to get a reward after an epoch because it has voted to ALL proposals (653ms)
        ✓ Should be able to get a reward after an epoch because it has voted to ALL - 1 proposals (642ms)
        ✓ Should not be able to get a reward after an epoch because it has not voted to at least ALL - 1 proposals (452ms)
        ✓ Should not be able to get a double reward for an epoch (632ms)
        ✓ Should be able to get a reward after X epoch because it voted to ALL - X proposals (6164ms)
        ✓ Should not be able to get a reward after X epoch because it did not voted to at least ALL - X proposals (3901ms)


  18 passing (24s)
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