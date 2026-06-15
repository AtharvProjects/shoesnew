const crypto = require('crypto');

/**
 * Calculates a 4-character checksum for an 8-character Machine ID.
 * Must match the Pascal Script logic in Inno Setup.
 */
function calculateChecksum(machineId) {
  let sum = 0;
  for (let i = 0; i < machineId.length; i++) {
    sum += machineId.charCodeAt(i);
  }
  
  // Basic scrambling that fits within 32-bit signed integer limits
  sum = (sum * 9973) % 65536;
  
  return sum.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates a hardware-locked license key
 */
function generateLicenseKey(machineId) {
  if (!machineId || machineId.length !== 8 || !/^[0-9A-F]{8}$/i.test(machineId)) {
    console.error('❌ Error: Please provide a valid 8-character hex Machine ID.');
    console.log('Usage: node scripts/generate-key.js <MACHINE_ID>');
    console.log('Example: node scripts/generate-key.js 0AF288DC');
    process.exit(1);
  }
  
  machineId = machineId.toUpperCase();
  
  const segment1 = machineId.substring(0, 4);
  const segment2 = machineId.substring(4, 8);
  const checksum = calculateChecksum(machineId);
  
  return `GKS-${segment1}-${segment2}-${checksum}`;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Please provide the client's Machine ID as an argument.");
  console.log('Usage: node scripts/generate-key.js <MACHINE_ID>');
  process.exit(1);
}

const key = generateLicenseKey(args[0]);

console.log('========================================');
console.log('✅ HARDWARE-LOCKED LICENSE KEY GENERATED');
console.log('========================================');
console.log(`Machine ID : ${args[0].toUpperCase()}`);
console.log(`License Key: ${key}`);
console.log('========================================');
console.log('This key will ONLY work on the computer that generated this Machine ID.');
