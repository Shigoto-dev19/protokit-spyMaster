import {
    Field,
    Struct,
    Experimental,
    Poseidon,
    Bool,
} from "o1js";

export class ProcessedMessage extends Struct({
    number: Field,
    digest: Field,
    securityCodeCheck: Bool,
    subjectCheck: Bool,  
}) {}

//? NOTE: Returning Bool checks makes it elaborate to track error source while preserving privacy
//? This is mainly for testing purposes otherwise verifying the proof is enough to tell if message details are valid
export function processMessage(
    messageNumber: Field,
    agentId: Field,
    subject: Field,
    securityCode: Field
) {
    // Validate security code length
    const securityLowerBound = securityCode.greaterThanOrEqual(10);
    const securityUpperBound = securityCode.lessThanOrEqual(99);
    const securityCodeCheck = securityLowerBound.and(securityUpperBound);

    // Validate message subject length
    const subjectLowerBound = subject.greaterThanOrEqual(10 ** 11);
    const subjectUpperBound = subject.lessThan(10 ** 12);
    const subjectCheck = subjectLowerBound.and(subjectUpperBound);

    const processedMessage = new ProcessedMessage({
        number: messageNumber,
        digest: Poseidon.hash([agentId, securityCode]),
        securityCodeCheck,
        subjectCheck,
    });

    return processedMessage;
}

export const MessageProcessor = Experimental.ZkProgram({
    key: 'message-processor',
    publicOutput: ProcessedMessage,

    methods: {
        processMessage: {
            privateInputs: [Field, Field, Field, Field],
            method: processMessage
        },
    },
});

export let MessageProof_ = Experimental.ZkProgram.Proof(MessageProcessor);
export class MessageProof extends MessageProof_ {}