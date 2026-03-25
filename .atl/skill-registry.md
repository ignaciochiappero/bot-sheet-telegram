# Skill Registry — bot-telegram-google-sheets

Generated: 2026-03-25

## Project Conventions

No project-level AGENTS.md / CLAUDE.md / .cursorrules detected (new empty project).

Global conventions from: `C:\Users\IgnacioChiappero\.config\opencode\AGENTS.md`

---

## Available Skills

### Coding Skills (user-level: ~/.claude/skills/)

| Name | Path | Trigger |
|------|------|---------|
| ai-sdk-5 | `~/.claude/skills/ai-sdk-5/SKILL.md` | Building AI chat features with Vercel AI SDK 5 |
| angular-architecture | `~/.claude/skills/angular-architecture/SKILL.md` | Structuring Angular projects |
| angular-core | `~/.claude/skills/angular-core/SKILL.md` | Angular components, signals, zoneless |
| angular-forms | `~/.claude/skills/angular-forms/SKILL.md` | Angular forms and validation |
| angular-performance | `~/.claude/skills/angular-performance/SKILL.md` | Angular performance optimization |
| django-drf | `~/.claude/skills/django-drf/SKILL.md` | Django REST Framework APIs |
| electron | `~/.claude/skills/electron/SKILL.md` | Electron desktop apps |
| elixir-antipatterns | `~/.claude/skills/elixir-antipatterns/SKILL.md` | Elixir/Phoenix code review |
| github-pr | `~/.claude/skills/github-pr/SKILL.md` | Creating Pull Requests |
| hexagonal-architecture-layers-java | `~/.claude/skills/hexagonal-architecture-layers-java/SKILL.md` | Java hexagonal architecture |
| java-21 | `~/.claude/skills/java-21/SKILL.md` | Java 21 patterns |
| jira-epic | `~/.claude/skills/jira-epic/SKILL.md` | Creating Jira epics |
| jira-task | `~/.claude/skills/jira-task/SKILL.md` | Creating Jira tasks |
| nextjs-15 | `~/.claude/skills/nextjs-15/SKILL.md` | Next.js 15 App Router |
| playwright | `~/.claude/skills/playwright/SKILL.md` | E2E tests with Playwright |
| pytest | `~/.claude/skills/pytest/SKILL.md` | Python tests with pytest |
| react-19 | `~/.claude/skills/react-19/SKILL.md` | React 19 patterns |
| react-native | `~/.claude/skills/react-native/SKILL.md` | React Native / Expo mobile apps |
| skill-creator | `~/.claude/skills/skill-creator/SKILL.md` | Creating new agent skills |
| spring-boot-3 | `~/.claude/skills/spring-boot-3/SKILL.md` | Spring Boot 3 patterns |
| tailwind-4 | `~/.claude/skills/tailwind-4/SKILL.md` | Tailwind CSS 4 |
| typescript | `~/.claude/skills/typescript/SKILL.md` | TypeScript strict patterns |
| zod-4 | `~/.claude/skills/zod-4/SKILL.md` | Zod 4 schema validation |
| zustand-5 | `~/.claude/skills/zustand-5/SKILL.md` | Zustand 5 state management |

### SDD Skills (user-level: ~/.claude/skills/)

| Name | Path |
|------|------|
| sdd-apply | `~/.claude/skills/sdd-apply/SKILL.md` |
| sdd-archive | `~/.claude/skills/sdd-archive/SKILL.md` |
| sdd-design | `~/.claude/skills/sdd-design/SKILL.md` |
| sdd-explore | `~/.claude/skills/sdd-explore/SKILL.md` |
| sdd-init | `~/.claude/skills/sdd-init/SKILL.md` |
| sdd-propose | `~/.claude/skills/sdd-propose/SKILL.md` |
| sdd-spec | `~/.claude/skills/sdd-spec/SKILL.md` |
| sdd-tasks | `~/.claude/skills/sdd-tasks/SKILL.md` |
| sdd-verify | `~/.claude/skills/sdd-verify/SKILL.md` |

### Additional Skills (user-level: ~/.config/opencode/skills/)

| Name | Path |
|------|------|
| go-testing | `~/.config/opencode/skills/go-testing/SKILL.md` |
| skill-creator | `~/.config/opencode/skills/skill-creator/SKILL.md` *(deduplicated, .claude wins)* |

---

## Relevant Skills for This Project

Given the stack (Node.js + AI SDK 5 + Groq + AWS Lambda + Terraform + Telegram + Google Sheets):

| Priority | Skill | Why |
|----------|-------|-----|
| ⭐ HIGH | `ai-sdk-5` | Core AI SDK usage with Groq |
| ⭐ HIGH | `typescript` | TypeScript strict patterns for Node.js |
| ⭐ HIGH | `zod-4` | Input validation for Telegram messages |
| MEDIUM | `github-pr` | PR creation conventions |
