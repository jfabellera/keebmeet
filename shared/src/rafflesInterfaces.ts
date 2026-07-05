export interface RaffleWinnerInfo {
  ticketId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  wins: number;
  claimed: boolean;
}

export interface RaffleRecordResponse {
  id: string;
  isBatchRoll: boolean;
  winners: RaffleWinnerInfo[];
  wasDisplayed: boolean;
  createdAt: Date;
}

export interface RollRaffleWinnerResponse {
  losers: string[];
  raffleRecord: RaffleRecordResponse;
}
