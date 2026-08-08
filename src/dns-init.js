import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
console.log('🌐 DNS resolution order set to ipv4first');
console.log(`🟢 Running on Node.js version: ${process.version}`);
