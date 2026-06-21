---
title: Zid OAuth Core Flow
status: stable
owner: platform
---

# Zid OAuth Core Flow

This document explains how a Zid merchant connects their store and how we persist
their access tokens. It is the human-readable companion to the code that KawnGraph
links automatically — no LLM required.

Source files:

- [oauth.ts](../src/lib/oauth.ts) — exchanges the authorization code for a token set.
- [storeTokens.ts](../src/server/repositories/storeTokens.ts) — persists tokens per store.

## The `GET /api/zid/oauth/callback` route

Zid redirects the merchant back to `app/api/zid/oauth/callback/route.ts` with a
short-lived `code`. The handler is the single entry point for the whole flow.

## `getMerchantContext` orchestration

The route delegates to `getMerchantContext`, defined in `src/lib/merchantAuth.ts`.
It performs two steps in order:

1. `exchangeCodeForToken` trades the `code` for a `TokenSet`.
2. `saveStoreTokens` writes that token set for the store.

Later requests read the persisted token back with `getStoreToken`. The outbound
token endpoint is resolved by `tokenEndpoint`.

## The `store_tokens` table

Tokens live in the `store_tokens` table, which references the `stores` table via
`store_id`. Each store therefore owns exactly one row of tokens.
