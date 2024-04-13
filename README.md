# Protokit Spy Master

This repository is a monorepo aimed at kickstarting application chain development using the Protokit framework.

The repository contains the solution to Challenge 3 of the Learn & Earn challenge series, which is part of the Mina Navigator program.

## Protokit & Privacy

Because of the hybrid execution module we can have private computation being done off chain, with a proof of that being sent on chain.
- The general approach would be: 
    - Perform off chain computation with private inputs to create a proof , and a public output.
    - Submit the proof to the sequencer as part of the transaction
    - The runtime module can verify the proof
    - The proof's public output can be used on chain for further business logic.

- In the case of the spy master AppChain, a privacy solution would be:
    - Store the states in initialize as usual.
    - `agentID` and `securityCode` are public states to assert the integrity of the agent details
        - These states can be hashed to add a layer of privacy.
    - In order to process the messages privately
        - Generate a proof off-chain for the messasge where the agentID & securityCode are publicInputs checked against the stored state.
        - The `subject`(main message) is a privateInput that is verified on-chain to prove that's is correct.

## Quick start

The monorepo contains 1 package and 1 app:

- `packages/chain` contains everything related to your app-chain
- `apps/web` contains a demo UI that connects to your locally hosted app-chain sequencer

**Prerequisites:**

- Node.js v18
- pnpm
- nvm

> If you're on windows, please use Docker until we find a more suitable solution to running the `@proto-kit/cli`. 
> Run the following command and then proceed to "Running the sequencer & UI":
>
> `docker run -it --rm -p 3000:3000 -p 8080:8080 -v %cd%:/starter-kit -w /starter-kit gplane/pnpm:node18 bash`


### Setup

```zsh
git clone https://github.com/proto-kit/starter-kit my-chain
cd my-chain

# ensures you have the right node.js version
nvm use
pnpm install
```

### Running the sequencer & UI

```zsh
# starts both UI and sequencer locally
pnpm dev

# starts UI only
pnpm dev -- --filter web
# starts sequencer only
pnpm dev -- --filter chain
```

### Running tests
```zsh
# run and watch tests for the `chain` package
pnpm run test --filter=chain -- --watchAll
```

Navigate to `localhost:3000` to see the example UI, or to `localhost:8080/graphql` to see the GQL interface of the locally running sequencer.
