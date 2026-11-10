/* Bulut arka ucu arayüzü ve veri türleri (yalnızca tür): cloud.ts bunu kullanır, firebase.ts ve artifactCloud.ts uygular.
   Ayrı dosyada ki arka uçlar cloud.ts'i içe aktarmasın (döngüsel bağımlılık olmasın). */
export type RedeemResult = 'ok' | 'invalid' | 'used' | 'error';
export interface LbRow { name: string; district: string; earned: number; me: boolean; }
export interface Account { enabled: boolean; linked: boolean; provider: string; apple: boolean; }
export interface RemoteSave { json: string; savedAt: number; earned: number; }
/** Sunucunun haftalık lig sonucu (league.ts kartı gösterir). */
export interface LeagueResult { week: string; from: number; to: number; rank: number; size: number; seal: boolean; }
export interface Hello { now?: number; code?: string; grants?: number; league?: { tier: number; result: LeagueResult | null }; }
export interface LeagueView { tier: number; group: string; rows: LbRow[]; myRank: number | null; size: number; }

/** Arka uçların uyguladığı arayüz. */
export interface Backend {
  uid: string | null;
  init(): Promise<boolean>;
  hello(localCode: string): Promise<Hello>;
  account(): Account;
  link(p: 'google' | 'apple'): Promise<'linked' | 'switched' | 'fail'>;
  deleteAccount(): Promise<boolean>;
  pushSave(json: string, savedAt: number, earned: number): Promise<void>;
  pullSave(): Promise<RemoteSave | null>;
  postScore(p: { week: string; earned: number; district: string; shares: number; total: number }): Promise<void>;
  /** Bu haftaki lig grubum (30 kişi); henüz gruba girmediysem null. */
  league(week: string): Promise<LeagueView | null>;
  redeemInvite(code: string): Promise<RedeemResult>;
}
