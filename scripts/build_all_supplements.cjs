const fs = require('fs');
const https = require('https');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const allPlayersRaw = JSON.parse(fs.readFileSync('src/data/allPlayers.json', 'utf8'));
const playerMap = new Map();
for (const p of allPlayersRaw) {
  const clean = p.name.replace(/\s+/g, '');
  playerMap.set(clean, p);
  playerMap.set(p.name, p);
}

function cleanPlayerName(raw) {
  if (!raw) return '';
  return raw
    .replace(/\[.*?\]/g, '')
    .replace(/[※\*＊◎☆★・]/g, '')
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/(竜王|名人|王位|王座|棋王|王将|棋聖|叡王|白玲|清麗|女王|女流王座|女流名人|女流王位|女流王将|倉敷藤花|NHK杯|銀河)/g, '')
    .replace(/(十七世名人|永世棋聖|永世竜王|名誉NHK杯選手権者|永世)/g, '')
    .replace(/(九段|八段|七段|六段|五段|四段|三段|女流六段|女流五段|女流四段|女流三段|女流二段|女流初段|女流1級|女流2級)/g, '')
    .replace(/(女流|所属)/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function resolvePlayerId(name) {
  const p = playerMap.get(name);
  return p ? p.id : `player-${name}`;
}

async function collectNHK75() {
  const html = await fetchUrl('https://ja.wikipedia.org/wiki/%E7%AC%AC75%E5%9B%9ENHK%E6%9D%AF%E3%83%86%E3%83%AC%E3%83%93%E5%B0%86%E6%A3%8B%E3%83%88%E3%83%BC%E3%83%8A%E3%83%A1%E3%83%B3%E3%83%88');
  const $ = cheerio.load(html);
  const matches = [];

  // Table 3: 出場女流棋士決定戦
  $('table.wikitable').eq(3).find('tr').each((_, tr) => {
    const cells = $(tr).find('th, td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length >= 4 && cells[0].includes('2025年')) {
      const dateMatch = cells[0].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        const y = dateMatch[1];
        const m = dateMatch[2].padStart(2, '0');
        const d = dateMatch[3].padStart(2, '0');
        matches.push({
          id: `res-nhk75-${y}-${m}-${d}-nishiyama-fukuma`,
          date: `${y}-${m}-${d}`,
          month: `${y}${m}`,
          sente: '西山朋佳',
          gote: '福間香奈',
          senteRaw: '西山朋佳 女流三冠',
          goteRaw: '福間香奈 女流四冠',
          sentePlayerId: resolvePlayerId('西山朋佳'),
          gotePlayerId: resolvePlayerId('福間香奈'),
          senteMark: '○',
          goteMark: '●',
          winner: '西山朋佳',
          loser: '福間香奈',
          winnerId: resolvePlayerId('西山朋佳'),
          loserId: resolvePlayerId('福間香奈'),
          resultType: 'normal',
          tournament: 'NHK杯',
          note: '出場女流棋士決定戦 121手',
          venue: '東京・NHK放送センター',
          isWomen: true,
          category: '女流棋戦',
          links: [{ title: 'NHK杯テレビ将棋トーナメント', url: 'https://www.shogi.or.jp/match/nhk/' }],
          sourceUrl: 'https://ja.wikipedia.org/wiki/第75回NHK杯テレビ将棋トーナメント',
        });
      }
    }
  });

  const tables = [
    { idx: 5, round: '1回戦' },
    { idx: 6, round: '2回戦' },
    { idx: 7, round: '3回戦' },
    { idx: 8, round: '決勝トーナメント' },
  ];

  tables.forEach(({ idx, round }) => {
    $('table.wikitable').eq(idx).find('tr').each((_, tr) => {
      const cells = $(tr).find('th, td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length < 5) return;

      const rowText = cells.join(' ');
      const dateMatch = rowText.match(/(\d{1,2})月(\d{1,2})日/);
      if (!dateMatch) return;

      const mStr = dateMatch[1].padStart(2, '0');
      const dStr = dateMatch[2].padStart(2, '0');
      const year = parseInt(mStr, 10) >= 4 ? '2025' : '2026';
      const date = `${year}-${mStr}-${dStr}`;
      const month = `${year}${mStr}`;

      let sente = '';
      let gote = '';
      let senteMark = '';
      let goteMark = '';
      let moves = '';

      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c === '○' || c === '●' || c === '□' || c === '■') {
          if (!senteMark) {
            senteMark = c;
            if (i > 0) sente = cells[i - 1];
            if (i + 1 < cells.length && /^\d+手$/.test(cells[i + 1])) {
              moves = cells[i + 1];
              if (i + 2 < cells.length) goteMark = cells[i + 2];
              if (i + 3 < cells.length) gote = cells[i + 3];
            } else if (i + 1 < cells.length && (cells[i + 1] === '○' || cells[i + 1] === '●' || cells[i + 1] === '□' || cells[i + 1] === '■')) {
              goteMark = cells[i + 1];
              if (i + 2 < cells.length) gote = cells[i + 2];
            }
          }
        }
      }

      const p1 = cleanPlayerName(sente);
      const p2 = cleanPlayerName(gote);

      if (p1 && p2 && p1 !== p2 && senteMark && goteMark) {
        const winner = senteMark === '○' || senteMark === '□' ? p1 : p2;
        const loser = winner === p1 ? p2 : p1;
        let roundName = cells[0].includes('局') || cells[0].includes('回戦') || cells[0].includes('決勝') ? cells[0] : round;
        if (roundName === '第1局' || roundName === '第2局' || roundName === '第3局' || roundName === '第4局') {
          roundName = `${round} ${roundName}`;
        }

        matches.push({
          id: `res-nhk75-${date}-${p1}-${p2}`,
          date,
          month,
          sente: p1,
          gote: p2,
          senteRaw: sente,
          goteRaw: gote,
          sentePlayerId: resolvePlayerId(p1),
          gotePlayerId: resolvePlayerId(p2),
          senteMark,
          goteMark,
          winner,
          loser,
          winnerId: resolvePlayerId(winner),
          loserId: resolvePlayerId(loser),
          resultType: (senteMark === '□' || goteMark === '□') ? 'fusen' : 'normal',
          tournament: 'NHK杯',
          note: `本戦 ${roundName}${moves ? ` ${moves}` : ''}`,
          venue: '東京・NHK放送センター',
          isWomen: p1.includes('西山') || p2.includes('西山') || p1.includes('福間') || p2.includes('福間'),
          category: '一般棋戦',
          links: [{ title: 'NHK杯テレビ将棋トーナメント', url: 'https://www.shogi.or.jp/match/nhk/' }],
          sourceUrl: 'https://ja.wikipedia.org/wiki/第75回NHK杯テレビ将棋トーナメント',
        });
      }
    });
  });

  return matches;
}

async function collectNHK74() {
  const html = await fetchUrl('https://ja.wikipedia.org/wiki/%E7%AC%AC74%E5%9B%9ENHK%E6%9D%AF%E3%83%86%E3%83%AC%E3%83%93%E5%B0%86%E6%A3%8B%E3%83%88%E3%83%BC%E3%83%8A%E3%83%A1%E3%83%B3%E3%83%88');
  const $ = cheerio.load(html);
  const matches = [];

  $('table.wikitable').each((_, tbl) => {
    $(tbl).find('tr').each((_, tr) => {
      const cells = $(tr).find('th, td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length < 5) return;

      const rowText = cells.join(' ');
      const dateMatch = rowText.match(/(\d{1,2})月(\d{1,2})日/);
      if (!dateMatch) return;

      const mStr = dateMatch[1].padStart(2, '0');
      const dStr = dateMatch[2].padStart(2, '0');
      const year = parseInt(mStr, 10) >= 4 ? '2024' : '2025';
      const date = `${year}-${mStr}-${dStr}`;
      const month = `${year}${mStr}`;

      let sente = '';
      let gote = '';
      let senteMark = '';
      let goteMark = '';
      let moves = '';

      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c === '○' || c === '●' || c === '□' || c === '■') {
          if (!senteMark) {
            senteMark = c;
            if (i > 0) sente = cells[i - 1];
            if (i + 1 < cells.length && /^\d+手$/.test(cells[i + 1])) {
              moves = cells[i + 1];
              if (i + 2 < cells.length) goteMark = cells[i + 2];
              if (i + 3 < cells.length) gote = cells[i + 3];
            } else if (i + 1 < cells.length && (cells[i + 1] === '○' || cells[i + 1] === '●' || cells[i + 1] === '□' || cells[i + 1] === '■')) {
              goteMark = cells[i + 1];
              if (i + 2 < cells.length) gote = cells[i + 2];
            }
          }
        }
      }

      const p1 = cleanPlayerName(sente);
      const p2 = cleanPlayerName(gote);

      if (p1 && p2 && p1 !== p2 && senteMark && goteMark) {
        const winner = senteMark === '○' || senteMark === '□' ? p1 : p2;
        const loser = winner === p1 ? p2 : p1;
        const roundName = cells[0].includes('局') || cells[0].includes('回戦') || cells[0].includes('決勝') ? cells[0] : '本戦';

        matches.push({
          id: `res-nhk74-${date}-${p1}-${p2}`,
          date,
          month,
          sente: p1,
          gote: p2,
          senteRaw: sente,
          goteRaw: gote,
          sentePlayerId: resolvePlayerId(p1),
          gotePlayerId: resolvePlayerId(p2),
          senteMark,
          goteMark,
          winner,
          loser,
          winnerId: resolvePlayerId(winner),
          loserId: resolvePlayerId(loser),
          resultType: (senteMark === '□' || goteMark === '□') ? 'fusen' : 'normal',
          tournament: 'NHK杯',
          note: `本戦 ${roundName}${moves ? ` ${moves}` : ''}`,
          venue: '東京・NHK放送センター',
          isWomen: p1.includes('西山') || p2.includes('西山') || p1.includes('福間') || p2.includes('福間'),
          category: '一般棋戦',
          links: [{ title: 'NHK杯テレビ将棋トーナメント', url: 'https://www.shogi.or.jp/match/nhk/' }],
          sourceUrl: 'https://ja.wikipedia.org/wiki/第74回NHK杯テレビ将棋トーナメント',
        });
      }
    });
  });

  return matches;
}

async function collectGinga33() {
  const html = await fetchUrl('https://ja.wikipedia.org/wiki/%E7%AC%AC33%E6%9C%9F%E9%8A%80%E6%B2%B3%E6%88%A6');
  const $ = cheerio.load(html);
  const matches = [];

  // Table 0: 決勝トーナメント (15局)
  $('table.wikitable').eq(0).find('tr').each((_, tr) => {
    const cells = $(tr).find('th, td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 6) return;

    const dateCell = cells.find(c => /^\d{1,2}\/\d{1,2}$/.test(c));
    if (!dateCell) return;

    const [mPart, dPart] = dateCell.split('/');
    const mStr = mPart.padStart(2, '0');
    const dStr = dPart.padStart(2, '0');
    const date = `2025-${mStr}-${dStr}`;
    const month = `2025${mStr}`;

    const scoreIdx = cells.findIndex(c => c.includes('○') || c.includes('●') || c.includes('□') || c.includes('■'));
    if (scoreIdx < 1) return;

    const scoreText = cells[scoreIdx];
    const p1Raw = cells[scoreIdx - 1];
    const p2Raw = cells[scoreIdx + 1]?.startsWith('(') ? cells[scoreIdx + 2] : cells[scoreIdx + 1];

    const p1 = cleanPlayerName(p1Raw);
    const p2 = cleanPlayerName(p2Raw);
    if (!p1 || !p2 || p1 === p2) return;

    const movesCell = cells.find(c => /^\d+手$/.test(c)) || '';

    let sente = p1;
    let gote = p2;
    let senteMark = '○';
    let goteMark = '●';
    let winner = p1;
    let loser = p2;
    let isFusen = scoreText.includes('□') || scoreText.includes('■');

    if (scoreText.includes('先 ○ - ●') || scoreText.includes('先 ○ - 先 ●') || scoreText.includes('○ - ●')) {
      sente = p1;
      gote = p2;
      senteMark = '○';
      goteMark = '●';
      winner = p1;
      loser = p2;
    } else if (scoreText.includes('● - 先 ○') || scoreText.includes('● - ○') || scoreText.includes('先 ● - 先 ○')) {
      sente = p2;
      gote = p1;
      senteMark = '○';
      goteMark = '●';
      winner = p2;
      loser = p1;
    } else if (scoreText.includes('■ - □')) {
      sente = p1;
      gote = p2;
      senteMark = '■';
      goteMark = '□';
      winner = p2;
      loser = p1;
      isFusen = true;
    }

    const roundText = cells[0].includes('回戦') || cells[0].includes('決勝') || cells[0].includes('準決勝') ? cells[0] : '決勝トーナメント';

    matches.push({
      id: `res-ginga33-${date}-${sente}-${gote}`,
      date,
      month,
      sente,
      gote,
      senteRaw: sente === p1 ? p1Raw : p2Raw,
      goteRaw: gote === p1 ? p1Raw : p2Raw,
      sentePlayerId: resolvePlayerId(sente),
      gotePlayerId: resolvePlayerId(gote),
      senteMark,
      goteMark,
      winner,
      loser,
      winnerId: resolvePlayerId(winner),
      loserId: resolvePlayerId(loser),
      resultType: isFusen ? 'fusen' : 'normal',
      tournament: '銀河戦',
      note: `決勝トーナメント ${roundText}${movesCell ? ` ${movesCell}` : ''}`,
      venue: '東京・囲碁将棋チャンネル',
      isWomen: sente.includes('西山') || gote.includes('西山') || sente.includes('福間') || gote.includes('福間'),
      category: '一般棋戦',
      links: [{ title: '銀河戦', url: 'https://www.shogi.or.jp/match/ginga/' }],
      sourceUrl: 'https://ja.wikipedia.org/wiki/第33期銀河戦',
    });
  });

  return matches;
}

async function collectGinga32() {
  const html = await fetchUrl('https://ja.wikipedia.org/wiki/%E7%AC%AC32%E6%9C%9F%E9%8A%80%E6%B2%B3%E6%88%A6');
  const $ = cheerio.load(html);
  const matches = [];

  $('table.wikitable').eq(0).find('tr').each((_, tr) => {
    const cells = $(tr).find('th, td').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length < 6) return;

    const dateCell = cells.find(c => /^\d{1,2}\/\d{1,2}$/.test(c));
    if (!dateCell) return;

    const [mPart, dPart] = dateCell.split('/');
    const mStr = mPart.padStart(2, '0');
    const dStr = dPart.padStart(2, '0');
    const date = `2024-${mStr}-${dStr}`;
    const month = `2024${mStr}`;

    const scoreIdx = cells.findIndex(c => c.includes('○') || c.includes('●') || c.includes('□') || c.includes('■'));
    if (scoreIdx < 1) return;

    const scoreText = cells[scoreIdx];
    const p1Raw = cells[scoreIdx - 1];
    const p2Raw = cells[scoreIdx + 1]?.startsWith('(') ? cells[scoreIdx + 2] : cells[scoreIdx + 1];

    const p1 = cleanPlayerName(p1Raw);
    const p2 = cleanPlayerName(p2Raw);
    if (!p1 || !p2 || p1 === p2) return;

    const movesCell = cells.find(c => /^\d+手$/.test(c)) || '';

    let sente = p1;
    let gote = p2;
    let senteMark = '○';
    let goteMark = '●';
    let winner = p1;
    let loser = p2;
    let isFusen = scoreText.includes('□') || scoreText.includes('■');

    if (scoreText.includes('先 ○ - ●') || scoreText.includes('先 ○ - 先 ●') || scoreText.includes('○ - ●')) {
      sente = p1;
      gote = p2;
      senteMark = '○';
      goteMark = '●';
      winner = p1;
      loser = p2;
    } else if (scoreText.includes('● - 先 ○') || scoreText.includes('● - ○') || scoreText.includes('先 ● - 先 ○')) {
      sente = p2;
      gote = p1;
      senteMark = '○';
      goteMark = '●';
      winner = p2;
      loser = p1;
    }

    const roundText = cells[0].includes('回戦') || cells[0].includes('決勝') || cells[0].includes('準決勝') ? cells[0] : '決勝トーナメント';

    matches.push({
      id: `res-ginga32-${date}-${sente}-${gote}`,
      date,
      month,
      sente,
      gote,
      senteRaw: sente === p1 ? p1Raw : p2Raw,
      goteRaw: gote === p1 ? p1Raw : p2Raw,
      sentePlayerId: resolvePlayerId(sente),
      gotePlayerId: resolvePlayerId(gote),
      senteMark,
      goteMark,
      winner,
      loser,
      winnerId: resolvePlayerId(winner),
      loserId: resolvePlayerId(loser),
      resultType: isFusen ? 'fusen' : 'normal',
      tournament: '銀河戦',
      note: `決勝トーナメント ${roundText}${movesCell ? ` ${movesCell}` : ''}`,
      venue: '東京・囲碁将棋チャンネル',
      isWomen: sente.includes('西山') || gote.includes('西山') || sente.includes('福間') || gote.includes('福間'),
      category: '一般棋戦',
      links: [{ title: '銀河戦', url: 'https://www.shogi.or.jp/match/ginga/' }],
      sourceUrl: 'https://ja.wikipedia.org/wiki/第32期銀河戦',
    });
  });

  return matches;
}

async function run() {
  console.log('Collecting NHK 75...');
  const nhk75 = await collectNHK75();
  console.log(`NHK 75: ${nhk75.length}`);

  console.log('Collecting NHK 74...');
  const nhk74 = await collectNHK74();
  console.log(`NHK 74: ${nhk74.length}`);

  console.log('Collecting Ginga 33...');
  const ginga33 = await collectGinga33();
  console.log(`Ginga 33: ${ginga33.length}`);

  console.log('Collecting Ginga 32...');
  const ginga32 = await collectGinga32();
  console.log(`Ginga 32: ${ginga32.length}`);

  const all = [...nhk75, ...nhk74, ...ginga33, ...ginga32];

  // Deduplicate by date + sorted players
  const seen = new Set();
  const deduped = [];
  for (const m of all) {
    const key = `${m.date}_${[m.sente, m.gote].sort().join('_')}_${m.tournament}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(m);
    }
  }

  console.log(`Total deduped supplement matches: ${deduped.length}`);
  fs.writeFileSync('src/data/specialMatchesSupplement.json', JSON.stringify(deduped, null, 2));
  console.log('Successfully wrote src/data/specialMatchesSupplement.json');
}

run();
