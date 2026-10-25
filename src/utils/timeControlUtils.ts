export function getTimeControlForTournament(tournament: string): string {
  if (!tournament) return '各4時間';
  if (tournament.includes('竜王戦')) return '各5時間 (決勝トーナメント・挑戦者決定三番勝負は各5時間 / 本戦は各3時間)';
  if (tournament.includes('名人戦') || tournament.includes('順位戦')) {
    if (tournament.includes('A級')) return '各6時間 (2日制)';
    if (tournament.includes('B級')) return '各6時間';
    return '各6時間';
  }
  if (tournament.includes('叡王戦')) return '持ち時間各4時間';
  if (tournament.includes('王位戦')) return '各4時間 (挑戦者決定リーグは各4時間)';
  if (tournament.includes('王座戦')) return '各5時間';
  if (tournament.includes('棋聖戦')) return '各4時間';
  if (tournament.includes('棋王戦')) return '各4時間';
  if (tournament.includes('王将戦')) return '各4時間 (挑戦者決定リーグは各4時間)';
  if (tournament.includes('朝日杯')) return '持ち時間各40分 (切れたら1分)';
  if (tournament.includes('銀河戦')) return '持ち時間各15分 (切れ負け)';
  if (tournament.includes('NHK杯')) return '1手30秒 (考慮時間各10分)';
  if (tournament.includes('JTプロ')) return '持ち時間各10分 (切れたら1手30秒)';
  if (tournament.includes('達人戦')) return '持ち時間各2時間';
  if (tournament.includes('新人王戦')) return '各3時間';
  if (tournament.includes('加古川青流戦')) return '各1時間 (切れたら1分)';
  if (tournament.includes('白玲戦') || tournament.includes('女流順位戦')) return '各4時間';
  if (tournament.includes('清麗戦')) return '各3時間';
  if (tournament.includes('マイナビ')) return '各3時間';
  if (tournament.includes('女流王座')) return '各3時間';
  if (tournament.includes('女流名人')) return '各3時間';
  if (tournament.includes('女流王位')) return '各3時間';
  if (tournament.includes('女流王将')) return '各25分 (切れたら1分)';
  if (tournament.includes('倉敷藤花')) return '各2時間';
  return '各4時間';
}
