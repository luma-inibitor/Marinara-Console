// The review queue: what the engine proposes, and what we send back.
//
// Preflight is a dry run — it reports what an accept would do without doing it
// — but it is still a POST, so it counts as a write against a real instance.

import { api } from "../../../shell/api";
import { parseWire } from "../../../shell/wire";
import { LTM } from "./routes";
import { ReviewResponseSchema } from "./schema";
import type { AcceptResponse, Mutation, PreflightResponse, ReviewResponse } from "./types";

/** The queue arrives as one document, so there is no element to drop: a
 *  mismatch throws and the screen shows the load error it already has. */
export const fetchReview = async (): Promise<ReviewResponse> =>
  parseWire(ReviewResponseSchema, await api(`${LTM}/drafts/review`), `GET ${LTM}/drafts/review`);
export const preflightDraft = (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }) =>
  api<PreflightResponse>(`${LTM}/drafts/${draftId}/preflight`, { method: "POST", body });
export const acceptDraft = (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }) =>
  api<AcceptResponse>(`${LTM}/drafts/${draftId}/accept`, { method: "POST", body });
export const skipMutations = (draftId: string, mutationIds: string[]) =>
  api<{ deleted: boolean; mutationIds?: string[] }>(`${LTM}/drafts/${draftId}/skip`, { method: "POST", body: { mutationIds } });
