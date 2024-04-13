import { Field, PrivateKey } from "o1js";
import { Message, MessageDetails, AgentData, AgentDetails } from "../src/messages";

export { 
  generateRandomMessage,
  generateValidAgentsData,
  generateRandomValidAgentData,
  generateValidMessage,
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

function generateRandomValidAgentData(messageNumber?: Field, maxRange=100) {
  const randomAgentId = Field.random();
  const randomSecurityCode = generateRandomNumber(10, 100);
  const agentDetails = new AgentDetails({
    agentId: randomAgentId,
    securityCode: Field(randomSecurityCode)
  });

  return new AgentData({   
    number: messageNumber ?? generateRandomMessageNumber(maxRange),
    details:agentDetails
  });
} 
  
function generateRandomMessage(messageNumber?: Field, maxRange=100): Message {
  return new Message({
    number: messageNumber ?? generateRandomMessageNumber(maxRange),
    details: new MessageDetails(generateRandomValidMessageDetails()),
  });
}

function generateValidMessage(agentData: AgentData) {
  const messageDetails = new MessageDetails({
    agentId: agentData.details.agentId,
    subject: Field(generateRandomNumber(10 ** 11, 10 ** 12)),
    securityCode: agentData.details.securityCode,
  });

  return new Message({
    number: agentData.number,
    details: messageDetails,
  });

}

function generateValidAgentsData(size=10, maxRange=100): [PrivateKey, AgentData][] {
  let agentsData: [PrivateKey, AgentData][] = [];
  for (let i = 0; i < size; i++) {
    const agentPrivateKey = PrivateKey.random();
    // const agentPublicKey = agentPrivateKey.toPublicKey();

    const randomValidAgent = generateRandomValidAgentData(undefined, maxRange);
    agentsData.push([agentPrivateKey, randomValidAgent]);
  }

  return agentsData;
}