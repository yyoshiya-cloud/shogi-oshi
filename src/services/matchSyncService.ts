import * as cheerio from 'cheerio';
import { Match, Player, ShogiMonthlyResult } from '../types/shogi';
import { PLAYERS_DATA } from '../data/shogiDatabase';
import { scrapeAllActivePlayers } from './playerSyncService';
import { getTodayDateString } from '../utils/dateUtils';
import { getTimeControlForTournament } from '../utils/timeControlUtils';
import results2026Json from '../data/results2026.json';
import {
  enrichMonthlyResultsWithSupplements,
  enrichAllResultsWithSupplements,
} from './matchSupplementService';



export interface MatchSyncResult {
  success: boolean;
  count: number;
  timestamp: string;
  matches: Match[];
  discoveredPlayers: Player[];
  source: string;
}

let cachedMatchResult: MatchSyncResult | null = null;
let lastMatchScrapeTime = 0;
const MATCH_CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cache

async function fetchWithTimeout(url: string, timeoutMs = 18000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) {
      return '';
    }
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(id);
  }
}

export function cleanTournamentName(rawName?: string): string {
  if (!rawName) return '公式戦';
  let t = rawName.trim();
  // Normalize "N H K杯", "ＮＨＫ杯", "N  H  K杯" to "NHK杯"
  if (/N\s*H\s*K杯/i.test(t) || /Ｎ\s*Ｈ\s*Ｋ杯/.test(t)) {
    t = t.replace(/N\s*H\s*K杯/gi, 'NHK杯').replace(/Ｎ\s*Ｈ\s*Ｋ杯/g, 'NHK杯');
  }
  return t;
}

/**
 * Scrape upcoming match schedule plans from https://www.shogi.or.jp/game/?tab=schedule
 * and convert them to the Match schema for the calendar.
 */
export async function scrapeMatchPlan(force = false): Promise<MatchSyncResult> {
  const now = Date.now();
  if (!force && cachedMatchResult && now - lastMatchScrapeTime < MATCH_CACHE_TTL_MS) {
    return cachedMatchResult;
  }

  // Ensure we have all current players to map against
  const playersData = await scrapeAllActivePlayers(false).catch(() => ({ players: PLAYERS_DATA }));
  const allKnownPlayers = playersData.players && playersData.players.length > 0 ? playersData.players : PLAYERS_DATA;

  const playerMap = new Map<string, Player>();
  for (const p of allKnownPlayers) {
    playerMap.set(p.name.replace(/\s+/g, ''), p);
    playerMap.set(p.name, p);
  }

  const html = await fetchWithTimeout('https://www.shogi.or.jp/game/?tab=schedule').catch(() => '');

  const parsedMatches: Match[] = [];
  const discoveredPlayers: Player[] = [];
  const discoveredMap = new Map<string, Player>();

  function resolvePlayer(raw: string): { id: string; name: string; rank: string } {
    const isLpsaMarker = /[※\*＊]/.test(raw);
    const normalizedName = raw.replace(/[※\*＊]/g, '').trim();
    const cleanedRaw = normalizedName.replace(/\s+/g, '');

    const existing = playerMap.get(cleanedRaw) || playerMap.get(normalizedName) || playerMap.get(raw.trim());
    if (existing) {
      return { id: existing.id, name: existing.name, rank: existing.rank || (existing.type === 'women' ? '女流棋士' : '棋士') };
    }

    const name = normalizedName;
    const id = `player-${cleanedRaw}`;
    if (!discoveredMap.has(id)) {
      const isWomen = isLpsaMarker || name.includes('女流');
      const newPlayer: Player = {
        id,
        name,
        type: isWomen ? 'women' : 'pro',
        affiliation: isLpsaMarker ? 'LPSA' : '日本将棋連盟',
        rank: isWomen ? '女流棋士' : '棋士',
        playerNumber: 0,
        birthDate: '',
        birthPlace: '',
        master: '',
        style: '居飛車',
        ryuoClass: '-',
        junisenClass: '-',
        heldTitles: [],
        totalTitles: 0,
        titleHistory: '',
        careerWins: 0,
        careerLosses: 0,
        careerWinRate: 0,
        currentYearWins: 0,
        currentYearLosses: 0,
        currentYearWinRate: 0,
        currentYearStreak: 0,
        rankingInFederation: {},
        colorAccent: isWomen ? '#ec4899' : '#6366f1',
        avatarBg: `linear-gradient(135deg, #18181b 0%, ${isWomen ? '#ec489933' : '#6366f133'} 100%)`,
        shortBio: `${name}（${isLpsaMarker ? 'LPSA所属女流棋士' : '日本将棋連盟公式戦'}）。公式対局予定登録棋士。`,
        highlights: [`日本将棋連盟公式対局予定登録`],
        yearRecords: [],
        senteWinRate: 0.5,
        goteWinRate: 0.5,
        openingStats: [],
        headToHead: [],
        externalLinks: {
          officialProfile: isLpsaMarker ? 'https://joshi-shogi.com/' : 'https://www.shogi.or.jp/player/',
          kifuDatabase: `https://shogidb2.com/search?q=${encodeURIComponent(name)}`,
        },
      };
      discoveredPlayers.push(newPlayer);
      discoveredMap.set(id, newPlayer);
      playerMap.set(cleanedRaw, newPlayer);
    }
    return { id, name, rank: '棋士' };
  }

  if (html) {
    const $ = cheerio.load(html);
    let currentDate = getTodayDateString();
    const currentYear = new Date().getFullYear();

    $('tr').each((_, tr) => {
      const $tr = $(tr);
      const text = $tr.text().trim();

      // Check if this row is a date header (e.g. "10月24日（土曜日）")
      const dateMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
      if (dateMatch && $tr.find('td').length <= 1) {
        const m = String(parseInt(dateMatch[1], 10)).padStart(2, '0');
        const d = String(parseInt(dateMatch[2], 10)).padStart(2, '0');
        currentDate = `${currentYear}-${m}-${d}`;
        return;
      }

      const cells = $tr.find('td, th').map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get();
      // Match rows typically have multiple cells: [empty, player1, player2, ..., tournament, note, venue]
      if (cells.length >= 5) {
        const p1Raw = cells[1];
        const p2Raw = cells[2];
        const tournament = cleanTournamentName(cells[4]);
        const note = cells[5] || '';
        const venue = cells[6] || '東京・将棋会館';

        if (p1Raw && p2Raw && p1Raw.length <= 10 && p2Raw.length <= 10 && !p1Raw.includes('対局者') && !p1Raw.includes('棋士')) {
          const p1 = resolvePlayer(p1Raw);
          const p2 = resolvePlayer(p2Raw);

          let category: Match['category'] = '一般棋戦';
          if (
            tournament.includes('女流王座') ||
            tournament.includes('白玲') ||
            tournament.includes('女流名人') ||
            tournament.includes('女流王将') ||
            tournament.includes('女流王位') ||
            tournament.includes('清麗') ||
            tournament.includes('女王') ||
            tournament.includes('倉敷藤花')
          ) {
            category = '女流タイトル戦';
          } else if (tournament.includes('女流')) {
            category = '女流棋戦';
          } else if (
            tournament.includes('竜王戦') ||
            tournament.includes('名人戦') ||
            tournament.includes('王位戦') ||
            tournament.includes('叡王戦') ||
            tournament.includes('王座戦') ||
            tournament.includes('棋王戦') ||
            tournament.includes('王将戦') ||
            tournament.includes('棋聖戦')
          ) {
            category = 'タイトル戦';
          } else if (tournament.includes('順位戦')) {
            category = '順位戦';
          }

          const matchId = `shogiorjp-${currentDate}-${p1.id}-${p2.id}`;
          const todayStr = getTodayDateString();
          const status = currentDate < todayStr ? 'finished' : currentDate === todayStr ? 'live' : 'upcoming';

          let time = '10:00';
          if (category === 'タイトル戦' || category === '女流タイトル戦' || (category === '順位戦' && tournament.includes('A級'))) {
            time = '09:00';
          }

          let youtubeUrl: string | undefined = undefined;
          $tr.find('a').each((_, a) => {
            const aText = $(a).text().trim();
            const href = $(a).attr('href');
            if (
              /youtube/i.test(aText) ||
              aText.includes('将棋連盟') ||
              (href && /youtube\.com|youtu\.be/i.test(href))
            ) {
              youtubeUrl = href?.startsWith('http') ? href : href ? `https://www.shogi.or.jp${href}` : undefined;
            }
          });

          // Check if note mentions YouTube
          const hasYoutube =
            /youtube/i.test(note) ||
            note.includes('YouTube') ||
            note.includes('ユーチューブ') ||
            Boolean(youtubeUrl);

          const broadcastList: string[] = [];
          if (hasYoutube) {
            broadcastList.push('将棋連盟YouTube');
            if (!youtubeUrl) {
              youtubeUrl = 'https://www.youtube.com/@shogi_channel';
            }
          }

          parsedMatches.push({
            id: matchId,
            tournament: tournament || '公式戦',
            category,
            round: note.includes('挑決') ? '挑戦者決定リーグ' : note.includes('決勝') ? '決勝' : note.includes('予選') ? '予選' : '本戦',
            date: currentDate,
            time,
            player1Id: p1.id,
            player2Id: p2.id,
            sentePlayerId: p1.id,
            gotePlayerId: p2.id,
            status,
            venue: venue || '東京・将棋会館',
            timeControl: getTimeControlForTournament(tournament),
            broadcast: broadcastList,
            youtubeUrl,
            kifuUrl: `https://shogidb2.com/search?q=${encodeURIComponent(`${p1.name} ${p2.name}`)}`,
            kifuMoves: [],
            highlights: `${p1.name} 対 ${p2.name} の公式戦（${tournament} ${note}）。`,
          });
        }
      }
    });
  }

  // Deduplicate matches using the unified deduplication rule (by date and sorted player IDs)
  const seen = new Set<string>();
  const uniqueMatches: Match[] = [];
  for (const m of parsedMatches) {
    if (!m.date || !m.player1Id || !m.player2Id) {
      uniqueMatches.push(m);
      continue;
    }
    const sortedPlayers = [m.player1Id, m.player2Id].sort().join('_');
    const key = `${m.date}_${sortedPlayers}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMatches.push(m);
    }
  }

  cachedMatchResult = {
    success: true,
    count: uniqueMatches.length,
    timestamp: new Date().toISOString(),
    matches: uniqueMatches,
    discoveredPlayers,
    source: 'https://www.shogi.or.jp/game/?tab=schedule',
  };
  lastMatchScrapeTime = now;

  return cachedMatchResult;
}

// In-memory cache for monthly results
const monthlyCache = new Map<string, { timestamp: number; data: ShogiMonthlyResult[] }>();
const MONTHLY_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache

/**
 * Scrape official match results for a given month (e.g. "202610")
 * from https://www.shogi.or.jp/game/?month=YYYYMM
 */
export interface MonthlyScrapeResult {
  success: boolean;
  month: string;
  count: number;
  results: ShogiMonthlyResult[];
  source: string;
  latestDate?: string | null;
  sinceDate?: string | null;
  newMatches?: ShogiMonthlyResult[];
  newCount?: number;
  hasNewMatches?: boolean;
}

/**
 * Scrape official match results for a given month (e.g. "202610")
 * from https://www.shogi.or.jp/game/?month=YYYYMM
 * Supports sinceDate to detect incremental updates after the latest recorded date.
 */
function buildScrapeResponse(
  month: string,
  results: ShogiMonthlyResult[],
  source: string,
  sinceDate?: string
): MonthlyScrapeResult {
  let latestDate: string | null = null;
  for (const r of results) {
    if (r.date && (!latestDate || r.date > latestDate)) {
      latestDate = r.date;
    }
  }
  const cleanSince = sinceDate ? sinceDate.trim() : '';
  const newMatches = cleanSince ? results.filter((r) => r.date > cleanSince) : [];
  const hasNewMatches = cleanSince ? newMatches.length > 0 : true;

  return {
    success: true,
    month,
    count: results.length,
    results,
    source,
    latestDate,
    sinceDate: cleanSince || null,
    newMatches,
    newCount: newMatches.length,
    hasNewMatches,
  };
}

export async function scrapeMonthlyResults(
  month: string,
  force = false,
  sinceDate?: string
): Promise<MonthlyScrapeResult> {
  const normalizedMonth = month.replace(/[^0-9]/g, '');
  const now = Date.now();

  if (!force && monthlyCache.has(normalizedMonth)) {
    const cached = monthlyCache.get(normalizedMonth)!;
    if (now - cached.timestamp < MONTHLY_CACHE_TTL_MS) {
      return buildScrapeResponse(
        normalizedMonth,
        cached.data,
        `cache:https://www.shogi.or.jp/game/?month=${normalizedMonth}`,
        sinceDate
      );
    }
  }

  // Ensure known players map for ID resolution
  const playersData = await scrapeAllActivePlayers(false).catch(() => ({ players: PLAYERS_DATA }));
  const allKnownPlayers = playersData.players && playersData.players.length > 0 ? playersData.players : PLAYERS_DATA;
  const playerMap = new Map<string, Player>();
  for (const p of allKnownPlayers) {
    playerMap.set(p.name.replace(/\s+/g, ''), p);
    playerMap.set(p.name, p);
  }

  const url = `https://www.shogi.or.jp/game/?month=${normalizedMonth}`;
  let html = '';
  try {
    html = await fetchWithTimeout(url, 12000);
  } catch (err) {
    console.warn(`[scrapeMonthlyResults] Failed to fetch upstream for month ${normalizedMonth}, falling back to bundled data`);
  }

  const results: ShogiMonthlyResult[] = [];
  const year = normalizedMonth.slice(0, 4) || '2026';
  const monthStr = normalizedMonth.slice(4, 6) || '10';

  if (html) {
    const $ = cheerio.load(html);
    let currentDate = `${year}-${monthStr}-01`;

    $('tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td, th').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
      const joined = cells.join(' ');

      const dateMatch = joined.match(/(\d{1,2})月(\d{1,2})日/);
      if (dateMatch && (cells.length <= 2 || $tr.find('th[colspan], td[colspan]').length > 0)) {
        const m = dateMatch[1].padStart(2, '0');
        const d = dateMatch[2].padStart(2, '0');
        currentDate = `${year}-${m}-${d}`;
        return;
      }

      if (cells.length >= 5) {
        const mark1 = cells[0];
        const p1Raw = cells[1];
        const p2Raw = cells[2];
        const mark2 = cells[3];
        const tournament = cleanTournamentName(cells[4]);
        const note = cells[5] || '';
        const venue = cells[6] || '';

        const isResultRow =
          mark1.includes('○') || mark1.includes('●') || mark1.includes('□') || mark1.includes('■') || mark1.includes('千') || mark1.includes('持') ||
          mark2.includes('○') || mark2.includes('●') || mark2.includes('□') || mark2.includes('■') || mark2.includes('千') || mark2.includes('持');

        if (isResultRow && p1Raw && p2Raw && p1Raw !== '先手' && p2Raw !== '後手') {
          const links: { title: string; url: string }[] = [];
          $tr.find('a').each((_, a) => {
            const rawTitle = $(a).text().trim();
            const href = $(a).attr('href');
            if (href && rawTitle) {
              // Exclude 携帯中継 and 中継 links
              if (rawTitle === '携帯中継' || rawTitle === '中継' || rawTitle.includes('携帯中継')) {
                return;
              }
              let title = rawTitle;
              if (
                /youtube/i.test(rawTitle) ||
                rawTitle.includes('将棋連盟') ||
                (href && /youtube\.com|youtu\.be/i.test(href))
              ) {
                title = '将棋連盟YouTube';
              }
              const fullUrl = href.startsWith('http') ? href : `https://www.shogi.or.jp${href}`;
              if (!links.some((l) => l.title === title || l.url === fullUrl)) {
                links.push({ title, url: fullUrl });
              }
            }
          });

          // Check if note mentions YouTube
          if (
            (note.includes('YouTube') || note.includes('youtube') || note.includes('将棋連盟YouTube')) &&
            !links.some((l) => l.title === '将棋連盟YouTube')
          ) {
            links.push({
              title: '将棋連盟YouTube',
              url: 'https://www.youtube.com/@shogi_channel',
            });
          }

          const cleanNote = note
            .replace(/・?携帯中継/g, '')
            .replace(/・?中継/g, '')
            .replace(/将棋連盟YouTube/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          const p1Clean = p1Raw.replace(/[※\*＊]/g, '').trim();
          const p2Clean = p2Raw.replace(/[※\*＊]/g, '').trim();

          let winner = '';
          let loser = '';
          let resultType: ShogiMonthlyResult['resultType'] = 'normal';

          if (mark1.includes('○')) {
            winner = p1Clean;
            loser = p2Clean;
          } else if (mark2.includes('○')) {
            winner = p2Clean;
            loser = p1Clean;
          } else if (mark1.includes('□')) {
            winner = p1Clean;
            loser = p2Clean;
            resultType = 'fusen';
          } else if (mark2.includes('□')) {
            winner = p2Clean;
            loser = p1Clean;
            resultType = 'fusen';
          } else if (mark1.includes('千') || mark2.includes('千')) {
            resultType = 'sennichite';
          } else if (mark1.includes('持') || mark2.includes('持')) {
            resultType = 'jishogi';
          }

          let category: ShogiMonthlyResult['category'] = '一般棋戦';
          if (
            tournament.includes('女流王座') ||
            tournament.includes('白玲') ||
            tournament.includes('女流名人') ||
            tournament.includes('女流王将') ||
            tournament.includes('女流王位') ||
            tournament.includes('清麗') ||
            tournament.includes('女王') ||
            tournament.includes('倉敷藤花')
          ) {
            category = '女流タイトル戦';
          } else if (tournament.includes('女流')) {
            category = '女流棋戦';
          } else if (
            tournament.includes('竜王戦') ||
            tournament.includes('名人戦') ||
            tournament.includes('王位戦') ||
            tournament.includes('叡王戦') ||
            tournament.includes('王座戦') ||
            tournament.includes('棋王戦') ||
            tournament.includes('王将戦') ||
            tournament.includes('棋聖戦')
          ) {
            category = 'タイトル戦';
          } else if (tournament.includes('順位戦')) {
            category = '順位戦';
          }

          const isWomen =
            p1Raw.includes('※') ||
            p2Raw.includes('※') ||
            category === '女流タイトル戦' ||
            category === '女流棋戦' ||
            tournament.includes('女流');

          const p1Obj = playerMap.get(p1Clean.replace(/\s+/g, '')) || playerMap.get(p1Clean);
          const p2Obj = playerMap.get(p2Clean.replace(/\s+/g, '')) || playerMap.get(p2Clean);

          const winnerObj = winner === p1Clean ? p1Obj : winner === p2Clean ? p2Obj : undefined;
          const loserObj = loser === p1Clean ? p1Obj : loser === p2Clean ? p2Obj : undefined;

          results.push({
            id: `res-${currentDate}-${p1Clean.replace(/\s+/g, '')}-${p2Clean.replace(/\s+/g, '')}-${results.length}`,
            date: currentDate,
            month: normalizedMonth,
            sente: p1Clean,
            gote: p2Clean,
            senteRaw: p1Raw,
            goteRaw: p2Raw,
            sentePlayerId: p1Obj?.id,
            gotePlayerId: p2Obj?.id,
            senteMark: mark1,
            goteMark: mark2,
            winner,
            loser,
            winnerId: winnerObj?.id,
            loserId: loserObj?.id,
            resultType,
            tournament,
            note: cleanNote,
            venue,
            isWomen,
            category,
            links,
            sourceUrl: url,
          });
        }
      }
    });
  }

  // If live scraping yielded results, update cache
  if (results.length > 0) {
    const enrichedResults = enrichMonthlyResultsWithSupplements(normalizedMonth, results);
    enrichedResults.sort((a, b) => b.date.localeCompare(a.date));
    monthlyCache.set(normalizedMonth, { timestamp: now, data: enrichedResults });
    return buildScrapeResponse(normalizedMonth, enrichedResults, url, sinceDate);
  }

  // Fallback to bundled JSON data if upstream is unreachable or empty
  const bundled = (results2026Json as Record<string, ShogiMonthlyResult[]>)[normalizedMonth];
  if (bundled && bundled.length > 0) {
    const enriched = enrichMonthlyResultsWithSupplements(
      normalizedMonth,
      bundled.map((b) => {
        const p1Obj = playerMap.get(b.sente.replace(/\s+/g, '')) || playerMap.get(b.sente);
        const p2Obj = playerMap.get(b.gote.replace(/\s+/g, '')) || playerMap.get(b.gote);
        return {
          ...b,
          sentePlayerId: p1Obj?.id,
          gotePlayerId: p2Obj?.id,
          winnerId: b.winner === b.sente ? p1Obj?.id : p2Obj?.id,
          loserId: b.loser === b.sente ? p1Obj?.id : p2Obj?.id,
        };
      })
    ).sort((a, b) => b.date.localeCompare(a.date));
    monthlyCache.set(normalizedMonth, { timestamp: now, data: enriched });
    return buildScrapeResponse(normalizedMonth, enriched, `bundled:${url}`, sinceDate);
  }

  // Even if both live scraping and bundled are empty, check if we have special tournament supplements
  const suppOnly = enrichMonthlyResultsWithSupplements(normalizedMonth, []);
  if (suppOnly.length > 0) {
    monthlyCache.set(normalizedMonth, { timestamp: now, data: suppOnly });
    return buildScrapeResponse(normalizedMonth, suppOnly, 'supplement:special_tournaments', sinceDate);
  }

  return {
    success: false,
    month: normalizedMonth,
    count: 0,
    results: [],
    source: url,
    latestDate: null,
    sinceDate: sinceDate || null,
    newMatches: [],
    newCount: 0,
    hasNewMatches: false,
  };
}

/**
 * Get results for all months in a given fiscal year (年度: 4月から翌年3月まで)
 * e.g. 2026年度: 202604 .. 202612, 202701 .. 202703
 */
export function getFiscalYearMonths(fiscalYear = 2026): string[] {
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) {
    months.push(`${fiscalYear}${String(m).padStart(2, '0')}`);
  }
  for (let m = 1; m <= 3; m++) {
    months.push(`${fiscalYear + 1}${String(m).padStart(2, '0')}`);
  }
  return months;
}

/**
 * Get results for multiple fiscal years (2025 and 2026),
 * keeping complete historical archive for 2025 and live scraping for 2026.
 */
async function getAllMultiYearResults(years = [2025, 2026], force = false): Promise<Record<string, ShogiMonthlyResult[]>> {
  const bundled = (results2026Json as Record<string, ShogiMonthlyResult[]>) || {};
  const res: Record<string, ShogiMonthlyResult[]> = { ...bundled };

  // Dynamically refresh 2026 fiscal year months
  if (years.includes(2026)) {
    const months2026 = getFiscalYearMonths(2026);
    for (const m of months2026) {
      const data = await scrapeMonthlyResults(m, force);
      if (data.results && data.results.length > 0) {
        res[m] = data.results;
      }
    }
  }
  return enrichAllResultsWithSupplements(res);
}

/**
 * Returns the YYYYMM format string for current month and optionally previous month.
 */
export function getCurrentAndPrevMonthStrings(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStr = `${year}${String(month).padStart(2, '0')}`;

  // If day is within the first 5 days of the month, also include previous month to catch late results
  if (now.getDate() <= 5) {
    const prevDate = new Date(year, month - 2, 1);
    const prevStr = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return [prevStr, currentStr];
  }

  return [currentStr];
}

/**
 * Gets results for multi-year data, but only scrapes active/current months incrementally
 * to minimize server scraping load and Firestore write quotas.
 */
export async function scrapeIncrementalResults(
  existingData: Record<string, ShogiMonthlyResult[]> = {},
  force = false
): Promise<{ merged: Record<string, ShogiMonthlyResult[]>; updatedMonths: string[] }> {
  const bundled = (results2026Json as Record<string, ShogiMonthlyResult[]>) || {};
  const res: Record<string, ShogiMonthlyResult[]> = { ...bundled, ...existingData };

  const targetMonths = getCurrentAndPrevMonthStrings();
  const updatedMonths: string[] = [];

  for (const m of targetMonths) {
    const scraped = await scrapeMonthlyResults(m, force);
    if (scraped.results && scraped.results.length > 0) {
      // Check if data actually changed compared to existing
      const existingList = res[m] || [];
      const isDifferent =
        existingList.length !== scraped.results.length ||
        JSON.stringify(existingList.map((r) => r.id)) !== JSON.stringify(scraped.results.map((r) => r.id));

      res[m] = scraped.results;
      if (isDifferent || force) {
        updatedMonths.push(m);
      }
    }
  }

  return {
    merged: enrichAllResultsWithSupplements(res),
    updatedMonths,
  };
}

/**
 * Get results for fiscal years (includes 2025 and 2026)
 */
export async function getAll2026Results(force = false): Promise<Record<string, ShogiMonthlyResult[]>> {
  if (!force) {
    const { merged } = await scrapeIncrementalResults({}, false);
    return merged;
  }
  return getAllMultiYearResults([2025, 2026], force);
}


