import { TestingAppChain } from "@proto-kit/sdk";
import { Field, PrivateKey, PublicKey } from "o1js";
import { 
    AgentData,
    MessagesSnapshot
} from "../src/messages";
import { log } from "@proto-kit/common";
import { 
  generateValidAgentsData,
  generateRandomValidAgentData,
  generateValidMessage,
} from "./testUtils";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";
import { Pickles } from "o1js/dist/node/snarky";
import { MessageProof, processMessage } from "../src/messageProof";

log.setLevel("ERROR");

describe("spy master snapshot", () => {
  let populatedAgentsData: [PrivateKey, AgentData][];
  let appChain: ReturnType<
    typeof TestingAppChain.fromRuntime<{ MessagesSnapshot: typeof MessagesSnapshot }>
  >;
  let spyMaster: MessagesSnapshot;
  
  beforeAll(async () => {
    populatedAgentsData = generateValidAgentsData(5, 10);

    appChain = TestingAppChain.fromRuntime({
      modules: {
        MessagesSnapshot,
      },
    });

    appChain.configurePartial({
      Runtime: {
        MessagesSnapshot: {},
      },
    });

    await appChain.start();
    spyMaster = appChain.runtime.resolve("MessagesSnapshot");
  });

  describe("AppChain: initialize method", () => {
    async function initializeTx(
      signerKey: PrivateKey,
      agentAddress: PublicKey,
      validAgentData: AgentData,
      txStatus = true
    ) {
      const signerAddress = signerKey.toPublicKey();
          
      let tx = await appChain.transaction(signerAddress, () => {
        spyMaster.registerAgent(agentAddress, validAgentData);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(txStatus);
      
      return block?.transactions[0].statusMessage;
    }

    it("initialize appchain with valid agent data", async () => {
      const signerKey = PrivateKey.random();

      appChain.setSigner(signerKey);
        
      for (let [agentKey, agentData] of populatedAgentsData) {
        await initializeTx(signerKey, agentKey.toPublicKey(), agentData);
      }
  
      const messageNumber =
        await appChain.query.runtime.MessagesSnapshot.lastMessageNumber.get();
      expect(messageNumber).toBeDefined();
      expect(messageNumber?.toBigInt()).not.toEqual(0n);
    }, 1_000_000);

    it("should reject agent data with invalid security code", async () => {
      const signerKey = PrivateKey.random();
  
      appChain.setSigner(signerKey);

      const agentKey = PrivateKey.random();
      let agentData = generateRandomValidAgentData();
      
      // Set an invalid security code
      agentData.details.securityCode = Field(123);

      const statusMessage = await initializeTx(
        signerKey,
        agentKey.toPublicKey(),
        agentData,
        false
      );

      const errorMessage = "The agent security code length must be exactly 2 characters!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);
  });

  //? For testing purposes, we verify that updating the extended state results in higher block height and nonces
  describe("AppChain: processMessage method", () => {
    async function processMessageTx(
      signerKey: PrivateKey,
      validMessage: ReturnType<typeof generateValidMessage>,
      txStatus=true
    ) {
      appChain.setSigner(signerKey);
      const signerAddress = signerKey.toPublicKey();
      
      // Generate a dummy proof, to be used when testing the runtime method
      const [, dummy] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
      const processedMessage = processMessage(
        validMessage.number,
        validMessage.details.agentId,
        validMessage.details.subject,
        validMessage.details.securityCode
      );

      const messageProof = new MessageProof({
        proof: dummy,
        publicOutput: processedMessage,
        publicInput: undefined,
        maxProofsVerified: 2,
      });
      
      let tx = await appChain.transaction(signerAddress, () => {
        spyMaster.processMessage(messageProof);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(txStatus);

      // Fetch the updated State
      //! There is no need to test sender's nonce as it always remains zero
      const newState =
        await appChain.query.runtime.MessagesSnapshot.registrySnapshot.get(signerAddress);
      expect(newState!.blockHeight.toBigInt()).toBeLessThanOrEqual(block?.networkState.during.block.height.toBigInt()!);
      
      return block?.transactions[0].statusMessage;
    }

    it("should accept agent valid message as it is and update state", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[0];
      const agentMessage = generateValidMessage(agentData);
      agentMessage.number = Field(12);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage,
      );

      expect(statusMessage).not.toBeDefined();
      const messageNumber =
        await appChain.query.runtime.MessagesSnapshot.lastMessageNumber.get();
      expect(messageNumber).toEqual(Field(12));
    }, 1_000_000);

    it("should accept agent valid message as it is and update last message number state: 3-10", async () => {
      for (let i = 1; i < populatedAgentsData.length; i++) {
        const [ agentKey, agentData ] = populatedAgentsData[i];
        const agentMessage = generateValidMessage(agentData);
        agentMessage.number = Field(12 + i);

        const statusMessage = await processMessageTx(
          agentKey, 
          agentMessage,
        );
        
        expect(statusMessage).not.toBeDefined();
        const messageNumber =
          await appChain.query.runtime.MessagesSnapshot.lastMessageNumber.get();
        expect(messageNumber).toEqual(Field(12 + i));
      }
    }, 1_000_000);
  });
});