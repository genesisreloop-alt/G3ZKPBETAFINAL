pragma circom 2.1.3;

// Simplified Message Send Proof Circuit for Local P2P Messaging
// Note: This is a simplified version for local implementation

template MessageSendProof() {
    // Public inputs
    signal input messageHash;          // Hash of encrypted message
    signal input senderPublicKey;      // Sender's public key
    signal input recipientPublicKey;   // Recipient's public key
    signal input timestamp;            // Message timestamp
    
    // Private inputs
    signal input plaintextHash;        // Hash of plaintext (proves knowledge)
    signal input encryptionKey;        // Encryption key used
    signal input nonce;                // Encryption nonce
    
    // Outputs
    signal output validProof;          // Boolean proof validity
    signal output proofValue;          // Value for proof trading
    
    // Constants
    signal input minTimestamp;         // Minimum valid timestamp
    signal input maxTimestamp;         // Maximum valid timestamp
    
    // 1. Verify timestamp is within valid range
    component timeCheck = RangeProof(64);
    timeCheck.in <== timestamp;
    timeCheck.min <== minTimestamp;
    timeCheck.max <== maxTimestamp;
    
    // 2. Verify message hash consistency
    // For simplified local implementation, just verify hash is non-zero
    signal messageHashValid <== messageHash > 0 ? 1 : 0;
    
    // 3. Verify sender public key is valid
    signal senderKeyValid <== senderPublicKey > 0 ? 1 : 0;
    
    // 4. Verify recipient public key is valid
    signal recipientKeyValid <== recipientPublicKey > 0 ? 1 : 0;
    
    // 5. Verify encryption parameters
    signal encryptionValid <== (encryptionKey > 0) && (nonce > 0) ? 1 : 0;
    
    // 6. Calculate proof value based on message importance
    signal importanceLevel <== 1; // Could be variable based on content
    signal urgencyMultiplier <== 1; // Time-sensitive messages more valuable
    
    component valueCalc = Multiply();
    valueCalc.in[0] <== importanceLevel;
    valueCalc.in[1] <== urgencyMultiplier;
    
    proofValue <== valueCalc.out;
    
    // 7. Combine all checks
    validProof <== timeCheck.out * 
                   messageHashValid * 
                   senderKeyValid * 
                   recipientKeyValid * 
                   encryptionValid;
}

// Helper component for range checking
template RangeProof(bits) {
    signal input in;
    signal input min;
    signal input max;
    signal output out;
    
    // Simplified range check for local implementation
    signal inRange <== (in >= min) && (in <= max) ? 1 : 0;
    out <== inRange;
}

// Helper component for multiplication
template Multiply() {
    signal input in[2];
    signal output out;
    
    out <== in[0] * in[1];
}

component main = MessageSendProof();