# SevaAI Manipur: System Workflow

Companion to [`architecture.md`](./architecture.md). This document focuses on **how things move**: data, AI, users, and interventions. All examples use **synthetic data**.

---

## 1. End-to-End Data Pipeline

```mermaid
flowchart LR
    A["Government datasets<br/>CSV / Excel / JSON / Mock API"] --> B["Ingestion<br/>Python + Pandas"]
    B --> C[("Raw staging")]
    C --> D["Validation & Cleaning"]
    D --> E["Geographic Normalization"]
    E -->|matched| F[("PostgreSQL + PostGIS<br/>Unified Data Layer")]
    E -->|unmatched| Q[("Quarantine for review")]
    F --> G["Analytics<br/>coverage, gaps, trends"]
    G --> H["AI Engine<br/>Isolation Forest + Priority Score + Explanation"]
    H --> I[("AI Scores + Alerts")]
    I --> J["FastAPI"]
    J --> K["Next.js"]
```

**Key points**
- Raw data is always kept so cleaning can be re-run.
- Unmatched villages never silently disappear. They go to quarantine.
- AI outputs are **written back to the database**, so the UI reads pre-computed results.

---

## 2. AI Decision Pipeline

```mermaid
flowchart TB
    R["Raw Data"] --> C["Cleaning"]
    C --> FE["Feature Engineering"]
    FE --> COV["Coverage Calculation"]
    COV --> GAP["Gap Calculation"]
    GAP --> HIST["Historical Features"]
    HIST --> AN["Anomaly Detection<br/>Isolation Forest"]
    HIST --> PR["Priority Analysis<br/>weighted score"]
    AN --> EX["Explainability<br/>SHAP / factor contributions"]
    PR --> EX
    EX --> INS["AI Insight<br/>plain-language summary"]
    INS --> REV["Official Review"]
    REV --> ACT["Administrative Action"]
```

**Rule:** the pipeline ends with a **human**, never with an automatic decision.

---

## 3. Village X Walkthrough (Synthetic)

| Indicator | Value |
|---|---|
| Water coverage | Very low |
| Welfare coverage | Very low |
| Health coverage | Low |
| Housing coverage | Moderately low |
| Pending cases | High |
| Trend | Worsening |
| **Priority score** | **87 / 100 (High, Red)** |
| **Anomaly** | Unusual combination of multi-service gaps: review recommended |

**Explanation shown to the official**

```
Main contributing factors:
  ▲ Low water coverage
  ▲ High pending cases
  ▲ Low welfare coverage
  ▲ Negative historical trend
```

**Next step:** official reviews → creates intervention → assigns officer → tracks to resolution.

---

## 4. Request Sequence: Opening a Village Page

```mermaid
sequenceDiagram
    actor Official
    participant UI as Next.js
    participant API as FastAPI
    participant DB as PostgreSQL/PostGIS

    Official->>UI: Click village on map
    UI->>API: GET /villages/{id} + JWT
    API->>API: Verify token, role, jurisdiction
    alt Not permitted
        API-->>UI: 403 Forbidden
        UI-->>Official: "You do not have access"
    else Permitted
        API->>DB: Fetch village, service records, AI score, alert
        DB-->>API: Data
        API-->>UI: JSON with coverage, gaps, score, anomaly, explanation
        UI-->>Official: Render village detail page
    end
```

---

## 5. Sequence: Creating an Intervention

```mermaid
sequenceDiagram
    actor DO as District Officer
    actor BO as Block Officer
    participant UI as Next.js
    participant API as FastAPI
    participant DB as Database

    DO->>UI: Click "Create Intervention"
    UI->>API: POST /interventions
    API->>API: Validate input + check role
    API->>DB: Insert intervention (Pending)
    API->>DB: Insert audit log (created)
    API-->>UI: 201 Created
    DO->>UI: Assign Block Officer
    UI->>API: PATCH /interventions/{id} (assignee)
    API->>DB: Update to Assigned + audit log
    BO->>UI: Start work
    UI->>API: PATCH /interventions/{id} (In Progress)
    API->>DB: Update + audit log
    DO->>UI: Verify outcome
    UI->>API: PATCH /interventions/{id} (Verified)
    API->>DB: Update + audit log
    DO->>UI: Resolve
    UI->>API: PATCH /interventions/{id} (Resolved)
    API->>DB: Update + audit log
```

---

## 6. Intervention Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Assigned
    Assigned --> InProgress
    InProgress --> Verified
    Verified --> Resolved
    Verified --> InProgress : Needs more work
    Pending --> Cancelled
    Assigned --> Cancelled
    Resolved --> [*]
    Cancelled --> [*]
```

| Status | Who typically moves it |
|---|---|
| Pending → Assigned | District Officer / State Admin |
| Assigned → In Progress | Assigned officer |
| In Progress → Verified | District Officer / State Admin |
| Verified → Resolved | District Officer / State Admin |
| Any → Cancelled | District Officer / State Admin (reason required) |

Every transition writes an **audit log entry**.

---

## 7. Official's Journey

```mermaid
flowchart TB
    L["Login"] --> D["Dashboard"]
    D --> S["See statewide / jurisdiction situation"]
    S --> F["Filter district"]
    F --> M["Open map"]
    M --> H["Identify high-priority village"]
    H --> V["Open village details"]
    V --> G["Review service gaps"]
    G --> X["Review AI explanation"]
    X --> N["Review anomaly"]
    N --> Dec{"Action needed?"}
    Dec -->|Yes| CI["Create intervention"]
    Dec -->|No| Note["Dismiss / add note"]
    CI --> AS["Assign officer"]
    AS --> TR["Track progress"]
    TR --> VR["Verify resolution"]
    VR --> CL["Close intervention"]
    CL --> AU["Audit history updated"]
    Note --> AU
```

---

## 8. Access Control Flow

```mermaid
flowchart LR
    U["User logs in"] --> T["JWT issued<br/>role + jurisdiction"]
    T --> R["Request to API"]
    R --> V{"Token valid?"}
    V -->|No| E1["401 Unauthorized"]
    V -->|Yes| P{"Role/jurisdiction allows?"}
    P -->|No| E2["403 Forbidden"]
    P -->|Yes| OK["Return filtered data"]
```

| Role | Scope |
|---|---|
| State Admin | All Manipur |
| District Officer | Assigned district |
| Block Officer | Assigned block |

---

## 9. Failure Handling Flow

```mermaid
flowchart TB
    S["Scoring run starts"] --> Q{"Data complete?"}
    Q -->|No| P["Mark partial / insufficient data"]
    Q -->|Yes| ML{"ML available and enough data?"}
    P --> ML
    ML -->|Yes| FULL["Analytical score + anomaly + explanation"]
    ML -->|No| FALL["Analytical score + factor contributions only"]
    FULL --> OUT["Write results"]
    FALL --> OUT
    OUT --> UI["UI shows results with data-quality labels"]
```

**Principle:** if ML fails, the transparent score still works. Missing data is never silently treated as zero.

---

## 10. Hackathon Build Order (Suggested)

| Phase | Goal | Owner(s) |
|---|---|---|
| 1 | Freeze DB schema and API response shapes | Data + Backend |
| 2 | Generate synthetic data and geography table | Data |
| 3 | Priority score and anomaly detection on a CSV | AI |
| 4 | Core API: login, villages, dashboard | Backend |
| 5 | Dashboard and village page using mock JSON | Frontend |
| 6 | Map with priority colours | Map/GIS |
| 7 | Intervention + audit endpoints and UI | Backend + Frontend |
| 8 | Connect everything end-to-end | Integration |
| 9 | Rehearse demo with backup recording | Everyone |

---

## 11. Demo Script Outline (for judges)

1. **Problem:** fragmented schemes, no combined view.
2. **Login** as District Officer.
3. **Dashboard:** priority areas and alerts.
4. **Map:** filter by district; spot a red village.
5. **Village page:** gaps, score, anomaly, explanation.
6. **Create intervention** and assign.
7. **Update status** to Verified/Resolved.
8. **Audit history.**
9. **Closing message:** *"AI informs. Officials decide. The system records."* All demo data is synthetic. Production would use authorized data channels.

## 12. Primary official workflow

```mermaid
flowchart TD
    Login["Official login"]
    Dashboard["Dashboard"]
    Filter["Filter district and block"]
    Map["Map and village list"]
    Select["Select village"]
    Coverage["View service coverage"]
    Gaps["Calculate gaps"]
    Priority["AI priority analysis"]
    Anomaly["Anomaly detection"]
    Explain["Explainability and limitations"]
    Review["Official review"]
    Create["Create intervention"]
    Assign["Assign officer"]
    Track["Track progress"]
    Verify["Verify"]
    Resolve["Resolve"]
    Audit["Audit log"]

    Login --> Dashboard --> Filter --> Map --> Select
    Select --> Coverage --> Gaps --> Priority --> Anomaly --> Explain
    Explain --> Review
    Review --> Create --> Assign --> Track --> Verify --> Resolve --> Audit
    Review -->|No action or more information| Dashboard
    Verify -->|More work required| Track
```

The backend authenticates the official and limits every request to the user's authorized role and geography. The dashboard and map show the active reporting period and data-quality context. Village details show available service numerators and denominators; for valid measures, **Coverage = Covered / Eligible × 100** and **Gap = 100 - Coverage**. If the denominator is zero or missing, coverage is unavailable rather than zero.

Priority and anomaly outputs are review aids. An anomaly means an unusual pattern requiring investigation; it is not fraud detection or proof of wrongdoing. The official checks source quality and context, then records whether follow-up is appropriate. AI never automatically approves or rejects benefits.

## 13. Intervention lifecycle

```mermaid
flowchart LR
    Review["Official review"]
    Draft["Create intervention"]
    Assigned["Assign officer"]
    Progress["Track progress"]
    Verification["Verify reported outcome"]
    Resolved["Resolve"]
    MoreWork["Return for more work"]
    Audit["Record each action in audit history"]

    Review --> Draft --> Assigned --> Progress --> Verification
    Verification -->|Verified| Resolved
    Verification -->|Incomplete| MoreWork --> Progress
    Draft -.-> Audit
    Assigned -.-> Audit
    Progress -.-> Audit
    Verification -.-> Audit
    Resolved -.-> Audit
```

The intervention records the reviewed issue, linked geography/service, responsible assignee, status, and relevant timestamps. Assignment, progress, verification, and resolution transitions are auditable. Verification must be performed by an authorized reviewer under the applicable operating policy; closing a task does not alter benefit eligibility or prove a model result was correct.
