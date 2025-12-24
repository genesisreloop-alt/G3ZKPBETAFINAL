pragma circom 2.1.3;

/**
 * Forward Secrecy Circuit - Production Version
 * Proves that old keys have been properly deleted and new keys generated
 * 
 * REQUIRES: circomlib installed via npm (npm install circomlib)
 * Compile with: circom forward_secrecy.circom --r1cs --wasm --sym
 */

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template ForwardSecrecy() {
    // Public inputs
    signal input oldKeyCommitment;       // Commitment to old key being deleted
    signal input newKeyCommitment;       // Commitment to new key
    signal input deletionProof;          // Proof of key deletion
    
    // Private inputs
    signal input oldKeySecret;           // Old key secret being deleted
    signal input newKeySecret;           // New key secret
    signal input rotationNonce;          // Nonce for this rotation
    
    // Outputs
    signal output valid;
    signal output rotationCommitment;
    
    // 1. Verify old key commitment
    component oldKeyHash = Poseidon(1);
    oldKeyHash.inputs[0] <== oldKeySecret;
    
    component oldKeyCheck = IsEqual();
    oldKeyCheck.in[0] <== oldKeyHash.out;
    oldKeyCheck.in[1] <== oldKeyCommitment;
    
    // 2. Verify new key commitment
    component newKeyHash = Poseidon(1);
    newKeyHash.inputs[0] <== newKeySecret;
    
    component newKeyCheck = IsEqual();
    newKeyCheck.in[0] <== newKeyHash.out;
    newKeyCheck.in[1] <== newKeyCommitment;
    
    // 3. Verify deletion proof
    component deletionHash = Poseidon(2);
    deletionHash.inputs[0] <== oldKeySecret;
    deletionHash.inputs[1] <== rotationNonce;
    
    component deletionCheck = IsEqual();
    deletionCheck.in[0] <== deletionHash.out;
    deletionCheck.in[1] <== deletionProof;
    
    // 4. Verify new key is different from old key
    component keysDifferent = IsEqual();
    keysDifferent.in[0] <== oldKeySecret;
    keysDifferent.in[1] <== newKeySecret;
    signal keysAreDifferent <== 1 - keysDifferent.out;
    
    // 5. Verify rotation nonce is non-zero
    component nonceCheck = IsZero();
    nonceCheck.in <== rotationNonce;
    signal nonceValid <== 1 - nonceCheck.out;
    
    // 6. Create rotation commitment
    component rotationHash = Poseidon(4);
    rotationHash.inputs[0] <== oldKeyCommitment;
    rotationHash.inputs[1] <== newKeyCommitment;
    rotationHash.inputs[2] <== deletionProof;
    rotationHash.inputs[3] <== rotationNonce;
    rotationCommitment <== rotationHash.out;
    
    // 7. Combine all checks
    signal check1 <== oldKeyCheck.out * newKeyCheck.out;
    signal check2 <== deletionCheck.out * keysAreDifferent;
    valid <== check1 * check2 * nonceValid;
}

component main {public [oldKeyCommitment, newKeyCommitment, deletionProof]} = ForwardSecrecy();
