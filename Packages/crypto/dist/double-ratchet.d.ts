interface MessageKey {
    key: Uint8Array;
    number: number;
    ratchetPublicKey: Uint8Array;
}
interface RatchetHeader {
    ratchetPublicKey: Uint8Array;
    previousChainLength: number;
    messageNumber: number;
}
export declare class DoubleRatchet {
    private initialKey;
    private sendingMessageNumber;
    private receivingMessageNumber;
    private previousSendingChainLength;
    private skippedMessageKeys;
    constructor(initialKey: Uint8Array);
    ratchetSend(): Promise<MessageKey>;
    ratchetReceive(header: RatchetHeader): Promise<MessageKey>;
    private generateMessageKey;
    getHeader(): RatchetHeader;
}
export {};
//# sourceMappingURL=double-ratchet.d.ts.map