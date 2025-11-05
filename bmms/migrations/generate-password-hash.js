/**
 * Password Hash Generator
 * 
 * Usage:
 *   node generate-password-hash.js "yourpassword"
 * 
 * This script generates bcrypt hashes for seeding demo accounts.
 * Default passwords:
 * - Admin: Admin@123
 * - Customer: Customer@123
 */

const bcrypt = require('bcrypt');

const passwords = {
  admin: 'Admin@123',
  customer: 'Customer@123',
};

async function generateHashes() {
  console.log('🔐 Generating Password Hashes...\n');
  
  for (const [role, password] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`${role}:`);
    console.log(`  Password: ${password}`);
    console.log(`  Hash: ${hash}\n`);
  }

  // If custom password provided via CLI
  const customPassword = process.argv[2];
  if (customPassword) {
    const customHash = await bcrypt.hash(customPassword, 10);
    console.log('Custom Password:');
    console.log(`  Password: ${customPassword}`);
    console.log(`  Hash: ${customHash}`);
  }
}

generateHashes().catch(console.error);
