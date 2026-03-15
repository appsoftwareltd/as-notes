---
title: Rename Wikilink picking up on changes incorrectly
lane: todo
created: 2026-03-11T10:06:05.604Z
updated: 2026-03-11T10:06:05.604Z
priority: medium
sortOrder: 2
---

## Conversation

[user]

Example on using `[[Project Name]]` and surrounding to create a nested wikilink. 

```
Rename [[[[Project Name]]]] → [[[[Project Name]] Test Evidences]]? This will update all matching links.
```

```
[[Project Name]]
[[[[Project Name]]]]
[[[[Project Name]] Test Evidences]] <- Rename notification appears on this change
```