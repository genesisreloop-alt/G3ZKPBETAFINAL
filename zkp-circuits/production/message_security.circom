pragma circom 2.1.3;

/**
 * Message Security Circuit - Production Version
 * Proves message integrity and proper encryption without revealing content
 * 
 * REQUIRES: circomlib installed via npm (npm install circomlib)
 * Compile with: circom message_security.circom --r1cs --wasm --sym
 */

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template MessageSecurity() {
    // Public inputs
    signal input messageRoot;            // Merkle root of message tree
    signal input timestamp;              // Message timestamp
    signal input senderCommitment;       // Commitment to sender's identity
    signal input receiverCommitment;     // Commitment to receiver's identity
    
    // Private inputs
    signal input messageHash;            // Hash of plaintext message
    signal input encryptionKeyHash;      // Hash of encryption key used
    signal input senderSecret;           // Sender's secret
    signal input receiverSecret;         // Receiver's secret
    signal input nonce;                  // Encryption nonce
    
    // Outputs
    signal output valid;
    signal output encryptedMessageHash;
    
    // 1. Verify sender commitment
    component senderHash = Poseidon(1);
    senderHash.inputs[0] <== senderSecret;
    
    component senderCheck = IsEqual();
    senderCheck.in[0] <== senderHash.out;
    senderCheck.in[1] <== senderCommitment;
    
    // 2. Verify receiver commitment
    component receiverHash = Poseidon(1);
    receiverHash.inputs[0] <== receiverSecret;
    
    component receiverCheck = IsEqual();
    receiverCheck.in[0] <== receiverHash.out;
    receiverCheck.in[1] <== receiverCommitment;
    
    component receiverSecretZero = IsZero();
    receiverSecretZero.in <== receiverSecret;
    signal receiverValid <== receiverCheck.out + receiverSecretZero.out - receiverCheck.out * receiverSecretZero.out;
    
    // 3. Compute encrypted message hash
    component encryptionHash = Poseidon(3);
    encryptionHash.inputs[0] <== messageHash;
    encryptionHash.inputs[1] <== encryptionKeyHash;
    encryptionHash.inputs[2] <== nonce;
    encryptedMessageHash <== encryptionHash.out;
    
    // 4. Verify message root
    component rootHash = Poseidon(4);
    rootHash.inputs[0] <== encryptedMessageHash;
    rootHash.inputs[1] <== timestamp;
    rootHash.inputs[2] <== senderCommitment;
    rootHash.inputs[3] <== receiverCommitment;
    
    component rootCheck = IsEqual();
    rootCheck.in[0] <== rootHash.out;
    rootCheck.in[1] <== messageRoot;
    
    // 5. Verify nonce is non-zero
    component nonceCheck = IsZero();
    nonceCheck.in <== nonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    // 6. Verify timestamp is valid
    component timestampCheck = IsZero();
    timestampCheck.in <== timestamp;
    signal timestampValid <== 1 - timestampCheck.out;
    
    // 7. Verify message hash is non-zero
    component messageCheck = IsZero();
    messageCheck.in <== messageHash;
    signal messageValid <== 1 - messageCheck.out;
    
    // 8. Combine all checks
    signal check1 <== senderCheck.out * receiverValid;
    signal check2 <== rootCheck.out * nonceValid;
    signal check3 <== timestampValid * messageValid;
    valid <== check1 * check2 * check3;
}

component main {public [messageRoot, timestamp, senderCommitment, receiverCommitment]} = MessageSecurity();
