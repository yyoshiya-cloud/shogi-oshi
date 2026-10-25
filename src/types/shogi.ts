export type PlayerType = 'pro' | 'women'; // 棋士 | 女流棋士
export type PlayerAffiliation = '日本将棋連盟' | 'LPSA' | '無所属';

export type OshiBadge = '本命' | '神推し' | '激推し' | '注目';

export interface YearRecord {
  year: number;
  wins: number;
  losses: number;
  rate: number;
}

export interface OpeningStat {
  name: string;
  winRate: number;
  count: number;
}

export interface HeadToHeadRecord {
  opponentId: string;
  opponentName: string;
  opponentRank: string;
  wins: number;
  losses: number;
}

export interface Player {
  id: string;
  name: string;
  kana: string;
  romaji: string;
  type: PlayerType;
  affiliation?: PlayerAffiliation; // 日本将棋連盟 | LPSA | 無所属
  rank: string; // 竜王・名人, 九段, 女流五冠, etc.
  danRank?: string; // 公式個人プロフィールから取得した段位 (九段, 七段, 女流五段, 女流六段, etc.)
  playerNumber: number; // 棋士番号 / 女流番号
  photoUrl?: string;
  birthDate: string; // YYYY-MM-DD
  birthPlace: string;
  master: string; // 師匠
  style: '居飛車' | '振り飛車' | 'オールラウンダー';
  ryuoClass: string; // 竜王戦 1組〜6組
  junisenClass: string; // 順位戦 A級, B級1組, etc.
  bloodType?: string;
  motto?: string;
  favPiece?: string;
  achievements?: string;
  heldTitles: string[]; // 現在保持しているタイトル
  totalTitles: number; // 通算タイトル獲得数
  titleHistory: string;
  careerWins: number;
  careerLosses: number;
  careerWinRate: number;
  currentYearWins: number;
  currentYearLosses: number;
  currentYearWinRate: number;
  currentYearStreak: number;
  rankingInFederation: {
    winsRank?: number;
    winRateRank?: number;
    matchesRank?: number;
  };
  colorAccent: string;
  avatarBg: string;
  shortBio: string;
  highlights: string[];
  yearRecords: YearRecord[];
  senteWinRate: number;
  goteWinRate: number;
  openingStats: OpeningStat[];
  headToHead: HeadToHeadRecord[];
  externalLinks: {
    officialProfile: string;
    kifuDatabase: string;
    wikipedia?: string;
  };
}

export interface FollowedPlayerConfig {
  playerId: string;
  badge: OshiBadge;
  color: string;
  cheeringNote: string;
  notificationsEnabled: boolean;
  notifyTiming: {
    dayBefore: boolean; // 前日20:00
    morningOf: boolean; // 当日8:00
    matchStart: boolean; // 対局開始時
    resultImmediately: boolean; // 終局結果速報
  };
  cheerCount: number;
  followedAt: string;
  fanComments: {
    id: string;
    text: string;
    createdAt: string;
  }[];
}

export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface MoveStep {
  ply: number;
  notation: string; // e.g. "▲７六歩", "△３四歩"
  comment?: string;
  board?: string[][]; // Optional 9x9 board snapshot
}

export interface Match {
  id: string;
  tournament: string; // e.g. "第38期 竜王戦 七番勝負 第3局"
  category: 'タイトル戦' | '順位戦' | '一般棋戦' | '女流タイトル戦' | '女流棋戦';
  round: string; // e.g. "第3局", "5回戦", "本戦トーナメント準決勝"
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:00"
  player1Id: string; // First player
  player2Id: string; // Second player
  sentePlayerId?: string; // 先手 (None if unrevealed / furikoma before match)
  gotePlayerId?: string; // 後手
  status: MatchStatus;
  venue: string; // e.g. "東京・将棋会館", "関西将棋会館", "名古屋対局場"
  timeControl: string; // e.g. "各8時間 (2日制)", "各6時間", "早指し 1手30秒"
  broadcast: string[]; // ["ABEMA 将棋チャンネル", "連盟モバイル中継", "囲碁将棋プレミアム"]
  winnerId?: string;
  movesCount?: number; // 手数 (e.g. 112手)
  endCondition?: string; // e.g. "投了", "千日手", "反則", "持将棋"
  openingStrategy?: string; // e.g. "角換わり腰掛け銀", "相掛かり", "四間飛車"
  kifuUrl: string; // Direct official / kifu db link
  kifuMoves: string[]; // Text list of moves
  highlights: string; // 短評・見どころ
}

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'match_day' | 'match_result' | 'match_start' | 'breaking';
  matchId?: string;
  playerId?: string;
  timestamp: string;
  read: boolean;
}

export interface ShogiMonthlyResult {
  id: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYYMM (e.g. "202610")
  sente: string;
  gote: string;
  senteRaw: string;
  goteRaw: string;
  sentePlayerId?: string;
  gotePlayerId?: string;
  senteMark: string; // '○' | '●' | '□' | '■' | '千' | '持'
  goteMark: string; // '○' | '●' | '□' | '■' | '千' | '持'
  winner: string;
  loser: string;
  winnerId?: string;
  loserId?: string;
  resultType: 'normal' | 'fusen' | 'sennichite' | 'jishogi';
  tournament: string;
  note: string;
  venue?: string;
  isWomen: boolean;
  category: 'タイトル戦' | '順位戦' | '一般棋戦' | '女流タイトル戦' | '女流棋戦';
  links: { title: string; url: string }[];
  sourceUrl: string;
}

