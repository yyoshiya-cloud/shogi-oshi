const fs = require('fs');
const players = JSON.parse(fs.readFileSync('./src/data/allPlayers.json', 'utf8'));

let defaultBioCount = 0;
let customBioCount = 0;
const samples = [];

players.forEach(p => {
  const bio = p.shortBio || '';
  if (bio.includes('日本将棋連盟所属の現役棋士') || bio.includes('日本将棋連盟所属の現役女流棋士') || bio.includes('公式棋士番号:') || bio.includes('女流番号:')) {
    defaultBioCount++;
    if (samples.length < 10) samples.push({ name: p.name, bio });
  } else {
    customBioCount++;
  }
});

console.log('Total players:', players.length);
console.log('Boilerplate shortBio count:', defaultBioCount);
console.log('Custom shortBio count:', customBioCount);
console.log('\nSample boilerplate bios:', samples);
