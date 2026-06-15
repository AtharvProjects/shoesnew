/**
 * License key validation logic for Gajraj Kirana
 */

import { execSync } from 'child_process';

/**
 * Gets the 8-character Volume Serial Number of the C: drive as the Machine ID
 */
export function getMachineId(): string {
  try {
    // vol c: output example: "Volume Serial Number is 0AF2-88DC"
    const output = execSync('cmd.exe /c "vol c:"').toString();
    const match = output.match(/[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}/);
    if (match) return match[0].replace('-', '').toUpperCase();
  } catch (e) {
    console.error('Failed to get Machine ID:', e);
  }
  return 'UNKNOWN0';
}

/**
 * Calculates a 4-character checksum for an 8-character Machine ID.
 */
function calculateChecksum(machineId: string): string {
  let sum = 0;
  for (let i = 0; i < machineId.length; i++) {
    sum += machineId.charCodeAt(i);
  }
  
  // Basic scrambling that fits within 32-bit signed integer limits
  sum = (sum * 9973) % 65536;
  
  return sum.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Validates a hardware-locked license key based on the Machine ID.
 * Format: GKS-{MachineID_P1}-{MachineID_P2}-{Checksum}
 */
export function isValidLicenseKey(key: string): boolean {
  if (!key) return false;
  
  // Format: GKS-XXXX-XXXX-XXXX
  const regex = /^GKS-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/;
  const match = key.match(regex);
  if (!match) return false;

  const machineIdInKey = match[1] + match[2];
  const checksumInKey = match[3];
  
  // 1. Verify mathematically that the checksum matches the Machine ID encoded in the key
  if (checksumInKey !== calculateChecksum(machineIdInKey)) return false;
  
  // 2. Verify that the Machine ID encoded in the key matches the physical computer
  if (machineIdInKey !== getMachineId()) return false;
  
  return true;
}
