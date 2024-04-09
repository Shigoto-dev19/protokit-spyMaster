import { AppChain, TestingAppChain } from "@proto-kit/sdk";
import { Field, PrivateKey, PublicKey } from "o1js";
import { Messages, Message } from "../src/messages";
import { log } from "@proto-kit/common";
import { generateRandomMessage, generateValidAgentsData } from "./testUtils";

log.setLevel("ERROR");

describe("spy master", () => {
  let populatedAgentsData: [PrivateKey, Message][];
  let appChain: ReturnType<
    typeof TestingAppChain.fromRuntime<{ Messages: typeof Messages }>
  >;
  
  beforeAll(async () => {
    populatedAgentsData = generateValidAgentsData(10, 10);

    appChain = TestingAppChain.fromRuntime({
      modules: {
        Messages,
      },
    });

    appChain.configurePartial({
      Runtime: {
        Messages: {},
      },
    });

    await appChain.start();
  });

  it("should initialize", async () => {
    const signerKey = PrivateKey.random();
    const signerAddress = signerKey.toPublicKey();

    appChain.setSigner(signerKey);

    const spyMaster = appChain.runtime.resolve("Messages");
    
    const initializeTx = async(agentAddress: PublicKey, validMessage: Message) => {
      let tx = await appChain.transaction(signerAddress, () => {
        spyMaster.initialize(agentAddress, validMessage);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(true);
    }

    for (let [agentKey, message] of populatedAgentsData) {
      await initializeTx(agentKey.toPublicKey(), message);
    }

    const messageNumber =
      await appChain.query.runtime.Messages.numberTracker.get();
    expect(messageNumber).toBeDefined();
    expect(messageNumber?.toBigInt()).not.toEqual(0n);
  }, 1_000_000);
});
