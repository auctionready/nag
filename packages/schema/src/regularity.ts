export const regularityValues = ["day", "week", "month"] as const;
export type Regularity = (typeof regularityValues)[number];
