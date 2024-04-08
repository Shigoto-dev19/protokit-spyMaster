//TODO init the appchain with value of valid agents
//TODO add integration tests for the challenge
//TODO clean dead code
//TODO update readme + answer to the challenge
//! before pushing, make sure to change the remote link and create a new repo

import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Field, Provable, PublicKey, Struct } from "o1js";

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
  @state() public numberTracker = State.from<Field>(Field);
  @state() public messages = StateMap.from<PublicKey, MessageDetails>(
    PublicKey,
    MessageDetails,
  );

  @runtimeMethod()
  public initialize(agentAddress: PublicKey, validMessage: Message) {
    // Fetch the highest message number tracker state
    let storedMessageNumber = this.numberTracker.get();

    // Initialize the highest message number tracker state to zero if never updated
    let highestMessageNumber = Provable.if(
      storedMessageNumber.isSome,
      storedMessageNumber.value,
      Field(0)
    );

    // Store the message state
    this.messages.set(agentAddress, validMessage.details);
    
    // Calculate the highest message number state
    highestMessageNumber = Provable.if(
      highestMessageNumber.lessThan(validMessage.number),
      validMessage.number,
      highestMessageNumber
    );

    // Update the highest message number state
    this.numberTracker.set(highestMessageNumber);
  }

  @runtimeMethod()
  public processMessage(message: Message) { 
    const latestNumber = this.numberTracker.get();
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
    
    const lowerBound = message.details.subject.greaterThanOrEqual(10**11);
    const upperBound = message.details.subject.lessThan(10**12);
    assert(
      lowerBound.and(upperBound),
      "The message length must be exactly 12 characters!"
    );

    // Update message number after all validations are completed.
    this.numberTracker.set(message.number);
  }
}
