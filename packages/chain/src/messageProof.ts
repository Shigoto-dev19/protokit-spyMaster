import { assert } from "@proto-kit/protocol";
import { Field, Struct, Experimental} from "o1js";
import { MessageDetails } from "./messages";

export class ProcessedMesage extends Struct({
  number: Field,
  digest: Field,
}) {}

export const messageProcessor = Experimental.ZkProgram({
    key: 'message-processor',
    publicOutput: ProcessedMesage,

    methods: {
        processMessage: {
            privateInputs: [Field, MessageDetails],
            method: (messageNumber: Field, messageDetails: MessageDetails) => {
                // Validate security code length
                const securityLowerBound = messageDetails.securityCode.greaterThanOrEqual(10);
                const securityUpperBound = messageDetails.securityCode.lessThanOrEqual(99);
                assert(
                securityLowerBound.and(securityUpperBound),
                "The agent security code length must be exactly 2 characters!"
                );

                // Validate message subject length
                const subjectLowerBound = messageDetails.subject.greaterThanOrEqual(10 ** 11);
                const subjectUpperBound = messageDetails.subject.lessThan(10 ** 12);
                assert(
                    subjectLowerBound.and(subjectUpperBound),
                    "The message length must be exactly 12 characters!"
                );

                const processedMessage = new ProcessedMesage({
                    number: messageNumber,
                    digest: messageDetails.digest(),
                });

                return processedMessage;
            },
        },
    },
});

export let MessageProof_ = Experimental.ZkProgram.Proof(messageProcessor);
export class MessageProof extends MessageProof_ {}