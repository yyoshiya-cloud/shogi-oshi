const fs = require('fs');
const players = JSON.parse(fs.readFileSync('./src/data/allPlayers.json', 'utf8'));

let issues = [];
players.forEach(p => {
  if (!p.romaji || typeof p.romaji !== 'string') {
    issues.push({ id: p.id, name: p.name, issue: 'Missing or invalid romaji' });
  }
});

console.log('Total players:', players.length);
console.log('Issues found:', issues.length);
issues.forEach(i => console.log(i));
