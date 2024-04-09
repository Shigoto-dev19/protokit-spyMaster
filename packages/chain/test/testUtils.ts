import { Field, PrivateKey, PublicKey } from "o1js";
import { Message, MessageDetails } from "../src/messages";

export { 
  generateRandomMessage,
  generateValidAgentsData,
}

function generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  function generateRandomMessageNumber(max = 2000): Field {
    return Field(generateRandomNumber(1, max));
  }
  
  function generateRandomValidMessageDetails(): MessageDetails {
    const randomAgentId = Field.random();
    const randomSubject = generateRandomNumber(10 ** 11, 10 ** 12);
    const randomSecurityCode = generateRandomNumber(10, 100);
    
    return {   
      agentId: randomAgentId,
      subject: Field(randomSubject),
      securityCode: Field(randomSecurityCode),
    }
  } 
  
  function generateRandomMessage(messageNumber?: Field, maxRange=100): Message {
    return new Message({
      number: messageNumber ?? generateRandomMessageNumber(maxRange),
      details: new MessageDetails(generateRandomValidMessageDetails()),
    });
  }
  
  function generateValidAgentsData(size=10, maxRange=100): [PrivateKey, Message][] {
    let agentsData: [PrivateKey, Message][] = [];
    for (let i = 0; i < size; i++) {
      const agentPrivateKey = PrivateKey.random();
      // const agentPublicKey = agentPrivateKey.toPublicKey();

      const randomValidMessage = generateRandomMessage(undefined, maxRange);
      agentsData.push([agentPrivateKey, randomValidMessage]);
    }
  
    return agentsData;
  }