// The review queue: what the engine proposes, and what we send back.
//
// Preflight is a dry run — it reports what an accept would do without doing it
// — but it is still a POST, so it counts as a write against a real instance.

import { api } from "../../../shell/api";
import { parseWire, parseWrite } from "../../../shell/wire";
import { LTM } from "./routes";
import { AcceptResponseSchema, PreflightResponseSchema, ReviewResponseSchema, SkipResponseSchema } from "./schema";
import type { AcceptResponse, Mutation, PreflightResponse, ReviewResponse, SkipResponse } from "./types";

export const fetchReview = async (): Promise<ReviewResponse> =>
  parseWire(ReviewResponseSchema, await api(`${LTM}/drafts/review`), `GET ${LTM}/drafts/review`);

export const preflightDraft = async (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }): Promise<PreflightResponse> =>
  parseWire(PreflightResponseSchema, await api(`${LTM}/drafts/${draftId}/preflight`, { method: "POST", body }), `POST ${LTM}/drafts/:id/preflight`);

export const acceptDraft = async (draftId: string, body: { mutationIds: string[]; editedMutations?: Mutation[] }): Promise<AcceptResponse> =>
  parseWrite(AcceptResponseSchema, await api(`${LTM}/drafts/${draftId}/accept`, { method: "POST", body }), `POST ${LTM}/drafts/:id/accept`);

export const skipMutations = async (draftId: string, mutationIds: string[]): Promise<SkipResponse> =>
  parseWrite(SkipResponseSchema, await api(`${LTM}/drafts/${draftId}/skip`, { method: "POST", body: { mutationIds } }), `POST ${LTM}/drafts/:id/skip`);
