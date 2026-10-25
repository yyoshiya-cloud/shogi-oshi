const cheerio = require('cheerio');

async function test() {
  const allLadyRes = await fetch('https://www.shogi.or.jp/game/?tab=all_lady');
  const allLadyHtml = await allLadyRes.text();
  const $all = cheerio.load(allLadyHtml);

  console.log('--- tab=all_lady tables count:', $all('table').length);
  $all('table').each((i, tbl) => {
    console.log('Table', i, 'rows:', $all(tbl).find('tr').length);
  });

  $all('tr').each((i, tr) => {
    const text = $all(tr).text().replace(/\s+/g, ' ');
    if (text.includes('中井') || text.includes('渡部') || text.includes('中倉') || text.includes('島井') || text.includes('磯谷') || text.includes('礒谷')) {
      const cells = $all(tr).find('th, td').map((j, c) => $all(c).text().replace(/\s+/g, ' ').trim()).get();
      console.log('Found in all_lady:', JSON.stringify(cells));
    }
  });

  const yearLadyRes = await fetch('https://www.shogi.or.jp/game/?tab=year_result_lady');
  const yearLadyHtml = await yearLadyRes.text();
  const $year = cheerio.load(yearLadyHtml);
  console.log('--- tab=year_result_lady tables count:', $year('table').length);
  $year('tr').each((i, tr) => {
    const text = $year(tr).text().replace(/\s+/g, ' ');
    if (text.includes('中井') || text.includes('渡部') || text.includes('中倉') || text.includes('島井') || text.includes('磯谷') || text.includes('礒谷')) {
      const cells = $year(tr).find('th, td').map((j, c) => $year(c).text().replace(/\s+/g, ' ').trim()).get();
      console.log('Found in year_result_lady:', JSON.stringify(cells));
    }
  });
}

test().catch(console.error);
