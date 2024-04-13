import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct } from "o1js";

export class AgentDetails extends Struct({
  agentId: Field, // 12 character
  securityCode: Field, // 2 character
}) {}

// Represents valid data for one existing agent
export class AgentData extends Struct({
  number: Field,
  details: AgentDetails,
}) {}

export class MessageDetails extends Struct({
  agentId: Field,
  subject: Field, // 12 character
  securityCode: Field, // 2 character
}) {}

export class Message extends Struct({
  number: Field,
  details: MessageDetails,
}) {}

@runtimeModule()
export class Messages extends RuntimeModule<Record<string, never>> {
  @state() public lastMessageNumber = State.from<Field>(Field);
  @state() public messages = StateMap.from<PublicKey, AgentDetails>(
    PublicKey,
    AgentDetails,
  );

  @runtimeMethod()
  public initialize(agentAddress: PublicKey, validAgent: AgentData) {
    // Fetch the highest message number tracker state
    let storedMessageNumber = this.lastMessageNumber.get();

    // Initialize the highest message number tracker state as zero if never updated
    let highestMessageNumber = Provable.if(
      storedMessageNumber.isSome,
      storedMessageNumber.value,
      Field(0)
    );
    
    // Reject agents with invalid security code
    const lowerBound = validAgent.details.securityCode.greaterThanOrEqual(10);
    const upperBound = validAgent.details.securityCode.lessThanOrEqual(99);
    assert(
      lowerBound.and(upperBound),
      "The agent security code length must be exactly 2 characters!"
    );

    // Store the agent details
    this.messages.set(agentAddress, validAgent.details);
    
    // Select the highest processed message number
    highestMessageNumber = Provable.if(
      highestMessageNumber.lessThan(validAgent.number),
      validAgent.number,
      highestMessageNumber
    );

    // Update the highest message number state
    this.lastMessageNumber.set(highestMessageNumber);
  }

  @runtimeMethod()
  public processMessage(message: Message) { 
    const latestNumber = this.lastMessageNumber.get();
    assert(
      message.number.greaterThan(latestNumber.value),
      "Message number does not exceed the highest number tracked thus far!"
    );
    
    const sender = this.transaction.sender.value;
    const agentDetails = this.messages.get(sender);
    assert(
      agentDetails.isSome,
      "Agent doesn't exist in the system!"
    );
    
    const storedAgentId = agentDetails.value.agentId;
    assert(
      message.details.agentId.equals(storedAgentId),
      "The Agent ID does not match the stored value in the system!"
    );
    
    const storedSecurityCode = agentDetails.value.securityCode;
    assert(
      message.details.securityCode.equals(storedSecurityCode),
      "The Agent Security Code does not match the stored value in the system!"
    );
    
    const lowerBound = message.details.subject.greaterThanOrEqual(10 ** 11);
    const upperBound = message.details.subject.lessThan(10 ** 12);
    assert(
      lowerBound.and(upperBound),
      "The message length must be exactly 12 characters!"
    );

    // Update the last message number state after all validations are completed.
    this.lastMessageNumber.set(message.number);
  }
}
