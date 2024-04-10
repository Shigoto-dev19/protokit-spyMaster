import { TestingAppChain } from "@proto-kit/sdk";
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
    it("initialize appchain with valid agent messages", async () => {
      const signerKey = PrivateKey.random();
      const signerAddress = signerKey.toPublicKey();
  
      appChain.setSigner(signerKey);
        
      const initializeTx = async (agentAddress: PublicKey, validMessage: Message) => {
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
        await appChain.query.runtime.Messages.lastMessageNumber.get();
      expect(messageNumber).toBeDefined();
      expect(messageNumber?.toBigInt()).not.toEqual(0n);
    }, 1_000_000);
  });
  
  describe("AppChain: processMessage method", () => {
    async function processMessageTx(
      signerKey: PrivateKey, 
      validMessage: Message, 
      txStatus=false
    ) {
      appChain.setSigner(signerKey);
      const signerAddress = signerKey.toPublicKey();

      let tx = await appChain.transaction(signerAddress, () => {
        spyMaster.processMessage(validMessage);
      });

      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(txStatus);

      return block?.transactions[0].statusMessage;
    }

    it("should reject message with lower message number", async () => {
      const [agentKey, agentMessage] = populatedAgentsData[0];
      
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
      
      const errorMessage = "The Agent ID does not match the stored value in the system!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with non-compliant security code", async () => {
      const [ agentKey, agentMessage ] = populatedAgentsData[0];

      // Set the number message to be the highest possible
      agentMessage.number = Field(-1);
      // Tamper with the message security code
      agentMessage.details.securityCode = Field.random();

      const statusMessage = await processMessageTx(
        agentKey, 
        agentMessage
      );
      
      const errorMessage = "The Agent Security Code does not match the stored value in the system!";
      expect(statusMessage!).toEqual(errorMessage);
    }, 1_000_000);

    it("should reject agent message with invalid subject: less than 12 characters", async () => {
      const [ agentKey, agentMessage ] = populatedAgentsData[1];
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
      const [ agentKey, agentMessage ] = populatedAgentsData[1];
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
      const [ agentKey, agentMessage ] = populatedAgentsData[1];
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
      const [ agentKey, agentMessage ] = populatedAgentsData[2];
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
        const [ agentKey, agentMessage ] = populatedAgentsData[i];
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
