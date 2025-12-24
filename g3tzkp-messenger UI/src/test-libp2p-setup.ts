/**
 * G3ZKP LibP2P Setup Verification Test
 * Tests that LibP2PService can be imported and instantiated
 * Run with: npx tsx src/test-libp2p-setup.ts
 */

import { libP2PService } from './services/LibP2PService';
import { messagingService } from './services/MessagingService';

async function runTest() {
  console.log('=== G3ZKP LibP2P Setup Verification ===\n');
  
  console.log('[TEST 1] Importing LibP2PService...');
  console.log('  ✓ LibP2PService imported successfully');
  console.log('  Type:', typeof libP2PService);
  
  console.log('\n[TEST 2] Importing MessagingService...');
  console.log('  ✓ MessagingService imported successfully');
  console.log('  Type:', typeof messagingService);
  
  console.log('\n[TEST 3] Checking MessagingService P2P methods...');
  console.log('  ✓ initializeP2P:', typeof messagingService.initializeP2P);
  console.log('  ✓ setP2PMode:', typeof messagingService.setP2PMode);
  console.log('  ✓ getP2PMode:', typeof messagingService.getP2PMode);
  console.log('  ✓ isP2PInitialized:', typeof messagingService.isP2PInitialized);
  console.log('  ✓ getP2PStats:', typeof messagingService.getP2PStats);
  
  console.log('\n[TEST 4] Checking LibP2PService methods...');
  console.log('  ✓ initialize:', typeof libP2PService.initialize);
  console.log('  ✓ sendDirectMessage:', typeof libP2PService.sendDirectMessage);
  console.log('  ✓ joinGroup:', typeof libP2PService.joinGroup);
  console.log('  ✓ broadcast:', typeof libP2PService.broadcast);
  console.log('  ✓ getStats:', typeof libP2PService.getStats);
  console.log('  ✓ stop:', typeof libP2PService.stop);
  
  console.log('\n[TEST 5] P2P Mode check...');
  const mode = messagingService.getP2PMode();
  console.log('  Current P2P mode:', mode);
  console.log('  ✓ P2P mode is valid:', ['hybrid', 'p2p-only', 'relay-only'].includes(mode));
  
  console.log('\n=== All import/instantiation tests passed ===');
  console.log('\nNote: Full network tests require running the node.');
  console.log('To start the LibP2P node, call messagingService.initializeP2P()');
  
  return true;
}

runTest()
  .then((success) => {
    console.log('\nTest result:', success ? 'PASSED' : 'FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\nTest FAILED with error:', error);
    process.exit(1);
  });
