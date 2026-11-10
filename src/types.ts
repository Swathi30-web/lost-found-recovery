export type Role = 'admin' | 'staff' | 'user';
export interface User { id: number; name: string; email: string; password: string; role: Role; active?: boolean }
export interface Category { id: number; name: string }

export const LOST_STATUSES = ['Open', 'Matched', 'Resolved', 'Closed'] as const;
export const FOUND_STATUSES = ['In Storage', 'Claim Pending', 'Returned', 'Closed'] as const;
export const CLAIM_STATUSES = ['Submitted', 'Under Review', 'More Information Required', 'Approved', 'Rejected'] as const;
export const HANDOVER_STATUSES = ['Ready for Handover', 'Handed Over', 'Closed'] as const;
export type LostStatus = (typeof LOST_STATUSES)[number];
export type FoundStatus = (typeof FOUND_STATUSES)[number];
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export interface LostReport {
  id: number; userId: number; itemName: string; categoryId: number; description: string;
  lastSeenLocation: string; lastSeenDate: string; identifyingDetails: string;
  contactPreference: string; image?: string; status: LostStatus; createdAt: string;
}
export interface FoundItem {
  id: number; reporterId: number; itemName: string; categoryId: number; description: string;
  foundLocation: string; foundDate: string; storageLocation: string; image?: string;
  status: FoundStatus; createdAt: string;
}
export interface Match { id: number; lostId: number; foundId: number; score: number; status: 'Suggested' | 'Confirmed' | 'Dismissed'; decidedBy: number | null; createdAt: string }
export interface Claim {
  id: number; foundId: number; lostId: number | null; userId: number; identifyingDetails: string;
  proofNotes: string; status: ClaimStatus; infoRequest?: string; createdAt: string; updatedAt: string;
}
export interface Verification { id: number; claimId: number; verifierId: number; status: ClaimStatus; note: string; createdAt: string }
export interface Handover {
  id: number; claimId: number; foundId: number; userId: number; status: HandoverStatus;
  verifierId: number | null; handoverDate: string | null; note?: string; createdAt: string;
}
export interface Notification { id: number; userId: number; type: 'match' | 'claim' | 'info' | 'handover'; message: string; link: string; read: boolean; createdAt: string }
export interface Activity { id: number; entityType: 'lost' | 'found' | 'claim' | 'handover'; entityId: number; action: string; actorId: number; note?: string; createdAt: string }
