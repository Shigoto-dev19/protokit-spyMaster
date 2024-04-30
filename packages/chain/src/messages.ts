import {
  RuntimeModule,
  runtimeModule,
  state,
  runtimeMethod,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Field, Poseidon, Provable, PublicKey, Struct } from "o1js";
import { MessageProof } from "./messageProof";

//TODO Update README for both branches

//TODO Use inheritance to extend state storage
//TODO udpate stored state to nonce, block height, transaction sender, 

export class AgentDetails extends Struct({
  agentId: Field, // 12 character
  securityCode: Field, // 2 character
}) {
  digest() {
    return Poseidon.hash([
      this.agentId,
      this.securityCode,
    ]);
  }
}

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
  // Maps agent addresses with their corresponding details digest
  @state() public messages = StateMap.from<PublicKey, Field>(
    PublicKey,
    Field,
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
    this.messages.set(agentAddress, validAgent.details.digest());
    
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
  public processMessage(messageProof: MessageProof) { 
    const sender = this.transaction.sender.value;
    const storedMessageDigest= this.messages.get(sender);
    assert(
      storedMessageDigest.isSome,
      "Agent doesn't exist in the system!"
    );

    const latestNumber = this.lastMessageNumber.get();

    const messageNumber = messageProof.publicOutput.number;
    
    assert(
      messageNumber.greaterThan(latestNumber.value),
      "Message number does not exceed the highest number tracked thus far!"
    );

    // 1. Verify that both the subject and agent security code are of the correct length 
    // 2. Maintain privacy of message details 
    messageProof.verify();
    
    assert(
      messageProof.publicOutput.securityCodeCheck,
      "The agent security code length must be exactly 2 characters!"
    );

    assert(
      messageProof.publicOutput.subjectCheck,
      "The message length must be exactly 12 characters!"
    );

    const messageDigest = messageProof.publicOutput.digest;
    assert(
      messageDigest.equals(storedMessageDigest.value),
      "Agent ID and/or security code is not compliant!"
    );

    // Update the last message number state after all validations are completed.
    this.lastMessageNumber.set(messageNumber);
  }
}
