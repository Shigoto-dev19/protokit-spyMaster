import { TestingAppChain } from "@proto-kit/sdk";
import { Bool, Field, PrivateKey, PublicKey } from "o1js";
import { 
  Messages, 
  AgentData,
} from "../src/messages";
import { log } from "@proto-kit/common";
import { 
  generateRandomMessage, 
  generateValidAgentsData,
  generateRandomValidAgentData,
  generateValidMessage,
} from "./testUtils";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";
import { Pickles } from "o1js/dist/node/snarky";
import { MessageProof, processMessage } from "../src/messageProof";

log.setLevel("ERROR");

describe("spy master", () => {
  let populatedAgentsData: [PrivateKey, AgentData][];
  let appChain: ReturnType<
    typeof TestingAppChain.fromRuntime<{ Messages: typeof Messages }>
  >;
  let spyMaster: Messages;
  
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
    spyMaster = appChain.runtime.resolve("Messages");
  });

  describe("AppChain: initialize method", () => {
    async function initializeTx(
      signerKey: PrivateKey,
      agentAddress: PublicKey, 
      validAgentData: AgentData, 
      txStatus=true
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
        await appChain.query.runtime.Messages.lastMessageNumber.get();
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
  
  describe("AppChain: processMessage method", () => {
    async function processMessageTx(
      signerKey: PrivateKey, 
      validMessage: ReturnType<typeof generateValidMessage>, 
      txStatus=false
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

      return block?.transactions[0].statusMessage;
    }

    it("should reject message with lower message number", async () => {
      const [agentKey, agentData] = populatedAgentsData[0];
      const agentMessage = generateValidMessage(agentData);
      
      const statusMessage = await processMessageTx(agentKey, agentMessage);
      const errorMessage = "Message number does not exceed the highest number tracked thus far!";
      
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject signer agent that doesn't exist in the system", async () => {
      const intruderAgentKey = PrivateKey.random();
      const intruderAgentMessage = generateRandomMessage(Field(-1));

      const statusMessage = await processMessageTx(
        intruderAgentKey, 
        intruderAgentMessage
      );
      
      const errorMessage = "Agent doesn't exist in the system!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with non-compliant agent ID", async () => {
      const [ agentKey ] = populatedAgentsData[0];
      const differentMessage = generateRandomMessage(Field(-1));

      const statusMessage = await processMessageTx(
        agentKey, 
        differentMessage
      );
      
      const errorMessage = "Agent ID and/or security code is not compliant!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with non-compliant security code", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[0];
      const agentMessage = generateValidMessage(agentData);

      // Set the number message to be the highest possible
      agentMessage.number = Field(-1);
      // Tamper with the message security code
      agentMessage.details.securityCode = Field(23);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "Agent ID and/or security code is not compliant!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with invalid security code: less than 2 characters", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[0];
      const agentMessage = generateValidMessage(agentData);

      // Set the number message to be the highest possible
      agentMessage.number = Field(-1);
      // Use an invalid security code
      agentMessage.details.securityCode = Field(2);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "The agent security code length must be exactly 2 characters!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with invalid security code: more than than 2 characters", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[0];
      const agentMessage = generateValidMessage(agentData);

      // Set the number message to be the highest possible
      agentMessage.number = Field(-1);
      // Use an invalid security code
      agentMessage.details.securityCode = Field(233);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "The agent security code length must be exactly 2 characters!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with invalid subject: less than 12 characters", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[1];
      const agentMessage = generateValidMessage(agentData);
      agentMessage.number = Field(-1);

      // Set the subject to be a number that has less than 12 digits 
      agentMessage.details.subject = Field(12345678910);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "The message length must be exactly 12 characters!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with invalid subject: more than 12 characters", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[1];
      const agentMessage = generateValidMessage(agentData);
      agentMessage.number = Field(-1);

      // Set the subject to be a number that has more than 12 digits 
      agentMessage.details.subject = Field(12345678910111213);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "The message length must be exactly 12 characters!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should accept agent new valid message with different subject and update last message number state", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[1];
      const agentMessage = generateValidMessage(agentData);
      agentMessage.number = Field(11);

      // Set the subject to be a number that has exactly 12 digits 
      agentMessage.details.subject = Field(123456789102);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage,
        true
      );
      
      expect(statusMessage).not.toBeDefined();
      const messageNumber =
        await appChain.query.runtime.Messages.lastMessageNumber.get();
      expect(messageNumber).toEqual(Field(11));
    }, 1_000_000);

    it("should accept agent valid message as it is and update last message number state", async () => {
      const [ agentKey, agentData ] = populatedAgentsData[2];
      const agentMessage = generateValidMessage(agentData);
      agentMessage.number = Field(12);

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage,
        true
      );
      
      expect(statusMessage).not.toBeDefined();
      const messageNumber =
        await appChain.query.runtime.Messages.lastMessageNumber.get();
      expect(messageNumber).toEqual(Field(12));
    }, 1_000_000);

    it("should accept agent valid message as it is and update last message number state: 3-10", async () => {
      for (let i = 2; i < populatedAgentsData.length; i++) {
        const [ agentKey, agentData ] = populatedAgentsData[i];
        const agentMessage = generateValidMessage(agentData);
        agentMessage.number = Field(12 + i);

        const statusMessage = await processMessageTx(
          agentKey, 
          agentMessage,
          true
        );
        
        expect(statusMessage).not.toBeDefined();
        const messageNumber =
          await appChain.query.runtime.Messages.lastMessageNumber.get();
        expect(messageNumber).toEqual(Field(12 + i));
      }
    }, 1_000_000);
  });
});
