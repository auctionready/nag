export interface RecentCheckInItem {
  id: string;
  /** Deemed time-slot time — what the check-in is credited to. */
  timestamp: Date;
  /** Wall-clock insert time. Differs from `timestamp` for back-filled check-ins. */
  createdAt: Date;
  /** Last modification time. Greater than `createdAt` when the timestamp was edited. */
  updatedAt: Date;
  skipped: boolean | null;
}
