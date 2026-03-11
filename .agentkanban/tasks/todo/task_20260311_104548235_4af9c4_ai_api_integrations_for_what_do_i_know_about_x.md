---
title: AI API integrations for "what do I know about [[X]]"
created: 2026-03-11T10:45:48.235Z
updated: 2026-03-11T10:45:48.235Z
sortOrder: 7
---

## Conversation

[user]

Simple version:

The user brings their own API key. We provide a list of model options and integrations.

The extension will chunk text based on the user query / wikilink / alias specified and forward to the agent for collation and summation.

Advanced version:

Full RAG + embeddings etc. Would need a DB - would the local WASM DB cope with this / be a good fit. It is somewhat throwaway currently (via rebuild) and that is a feature. Would vector embeddings be more of an investment in the DB?