---
order: 90
---

# Development Roadmap

This roadmap outlines the planned development trajectory for AS Notes. Layers are delivered sequentially - a layer begins once its predecessor is complete. Work items within a layer may be developed in parallel.

Last Update: [[2026-03-29]]

```mermaid
flowchart TD
    subgraph L1["Platform Stabilisation"]
        direction TB
        STA_1[Bug fixes / Quality of life improvements]
        STA_2[Documentation]
    end

    subgraph L2["Outliner Mode and Concept Relationship Enhancements"]
        direction TB
        OME_1[Text editing / formatting behaviours]
        OME_2[Consolidated reference content view]
    end

    subgraph L3["Data Queries"]
        direction TB
        DQ_1[Data query structure]
        DQ_2[Data query results presentation]
    end

    subgraph L4["Data Sync and Companion Web App"]
        direction TB
        DSCWA_1[Data sync]
        DSCWA_1[Readonly only companion mobile friendly web app]
    end

    subgraph L5["Web Editor"]
        direction TB
        WE_1[Full edit capable mobile web app]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
```
