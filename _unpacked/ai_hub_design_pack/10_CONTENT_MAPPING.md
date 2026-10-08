# 10 — Content → Component Mapping

Rule: **reuse the 6 existing templates**. No new card styles.

| AI Hub category | Primary template | Secondary / detail | Accent rule |
|---|---|---|---|
| Learning (courses, paths) | **CourseCard** (media blue/orange) | PhaseCard (learning path), DashboardCard (progress) | blue default, orange = "new"/featured |
| Models | **ResourceCard** (folder) | NodeMap node (relations), CodeWindow (usage snippet) | category icon only |
| Tools | ResourceCard | FeatureCard (workbench-style highlights) | |
| MCP (servers) | ResourceCard | FlowGraph target pill (connections) | |
| Skills | ResourceCard | FlowGraph hub pill, NodeMap pill | |
| Agents | ResourceCard | FlowGraph source / hub pill | |
| Plugins | ResourceCard | FlowGraph target pill | |
| Prompts | ResourceCard (desc = prompt preview, 4-line clamp) | CodeWindow for full prompt | |
| Documentation | ResourceCard | TopicList (index pages) | |
| Updates | **UpdateRow** = MetaRow + title + Badge, inside TopicList layout, 1px muted divider between rows | — | Badge ink; orange dot for "new" |
| Credits / offers | **FeatureCard** (title, 2-line desc, ink button) | — | no new colours, no price badges in colour |
| Comparisons | **DashboardCard**-style ComparisonModule: ProgressRow per metric × N columns | — | bars ink; one blue highlight column max |

UpdateRow and ComparisonModule are *compositions* of existing primitives (MetaRow, Badge, ProgressRow, outline card) — not new visual styles.

## Section ↔ content (landing page order, from B copy)
1. **Everything AI.** → Library: ResourceCards for Featured Models · Tool Listings · MCP Servers · Model Architectures · Learn connection; second row = "Curated resources" TopicList + 2 cards.
2. **Understand AI.** → NodeMap of concepts/models/skills/MCP.
3. **Build with AI.** → Workshop + FeatureCards "Developer workbench", "API Integrations".
4. **Learn AI.** → 3 CourseCards + User dashboard.
5. **Integrate AI. Ecosystem.** → FlowGraph Skills/Tools/Agents → Model, MCP Servers, Integrations, Data Visualization…
6. **Implement AI.** → Journey Learn → Understand → Practice → Build.
Alternate sections between light and dark only if the user confirms (see Q4); the reference shows Build + Implement in dark.

## Card category icons (16px line, Lucide names) [NEEDS VERIFICATION]
Models `boxes` · Tools `wrench` · MCP `plug` · Skills `sparkle`→ avoid sparkle (generic AI) use `puzzle` · Agents `bot` · Plugins `blocks` · Prompts `message-square-text` · Docs `book-open` · Updates `bell` · Credits `ticket` · Comparisons `columns-2` · Learning `graduation-cap`.