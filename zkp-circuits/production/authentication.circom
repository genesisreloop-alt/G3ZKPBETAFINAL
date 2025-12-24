pragma circom 2.1.3;

/**
 * Authentication Circuit - Production Version
 * Proves identity ownership without revealing the identity secret
 * 
 * REQUIRES: circomlib installed via npm (npm install circomlib)
 * Compile with: circom authentication.circom --r1cs --wasm --sym
 */

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template Authentication() {
    // Public inputs
    signal input identityCommitment;     // Commitment to identity (Poseidon(secret, nullifier))
    signal input nullifierHash;          // Hash of nullifier for this context
    signal input externalNullifier;      // Context-specific nullifier
    
    // Private inputs
    signal input identitySecret;         // User's secret identity value
    signal input identityNullifier;      // User's nullifier seed
    
    // Output
    signal output valid;
    
    // 1. Verify identity commitment
    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== identitySecret;
    commitmentHash.inputs[1] <== identityNullifier;
    
    component commitmentCheck = IsEqual();
    commitmentCheck.in[0] <== commitmentHash.out;
    commitmentCheck.in[1] <== identityCommitment;
    
    // 2. Compute and verify nullifier hash
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identityNullifier;
    nullifierHasher.inputs[1] <== externalNullifier;
    
    component nullifierCheck = IsEqual();
    nullifierCheck.in[0] <== nullifierHasher.out;
    nullifierCheck.in[1] <== nullifierHash;
    
    // 3. Verify identity secret is non-zero
    component secretNonZero = IsZero();
    secretNonZero.in <== identitySecret;
    signal secretValid <== 1 - secretNonZero.out;
    
    // 4. Verify nullifier is non-zero
    component nullifierNonZero = IsZero();
    nullifierNonZero.in <== identityNullifier;
    signal nullifierValid <== 1 - nullifierNonZero.out;
    
    // 5. Combine all validity checks
    signal check1 <== commitmentCheck.out * nullifierCheck.out;
    signal check2 <== secretValid * nullifierValid;
    valid <== check1 * check2;
}

component main {public [identityCommitment, nullifierHash, externalNullifier]} = Authentication();
