export interface RaffleWinnerInfo {
  ticketId: number;
  displayName: string;
  firstName: string;
  lastName: string;
  wins: number;
  claimed: boolean;
}

export interface RaffleRecordResponse {
  id: number;
  isBatchRoll: boolean;
  winners: RaffleWinnerInfo[];
  wasDisplayed: boolean;
  createdAt: Date;
}

export interface RollRaffleWinnerResponse {
  losers: string[];
  raffleRecord: RaffleRecordResponse;
}
