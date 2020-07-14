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