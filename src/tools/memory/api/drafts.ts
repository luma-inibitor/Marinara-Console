// The review queue: what the engine proposes, and what we send back.
//
// Preflight is a dry run — it reports what an accept would do without doing it
// — but it is still a POST, so it counts as a write against a real instance.

import { call } from "./client";
import type { AcceptResponse, Mutation, PreflightResponse, ReviewResponse, SkipResponse } from "./types";

type Selection = { mutationIds: string[]; editedMutations?: Mutation[] };

export const fetchReview = (): Promise<ReviewResponse> =>
  call("GET /drafts/review");

export const preflightDraft = (draftId: string, body: Selection): Promise<PreflightResponse> =>
  call("POST /drafts/:id/preflight", { params: { id: draftId }, body });

export const acceptDraft = (draftId: string, body: Selection): Promise<AcceptResponse> =>
  call("POST /drafts/:id/accept", { params: { id: draftId }, body });

export const skipMutations = (draftId: string, mutationIds: string[]): Promise<SkipResponse> =>
  call("POST /drafts/:id/skip", { params: { id: draftId }, body: { mutationIds } });
