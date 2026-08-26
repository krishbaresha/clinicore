# **CliniCore — UI/UX Pro Max Redesign Roadmap & Agent Instruction Set**

> **IMPORTANT FOR AI CODING AGENT (Antigravity / Cursor / Claude):**

> This directory contains the authoritative, zero-regression UI/UX Transformation Specifications for CliniCore.

> Read every prompt file sequentially (01\_UI\_Design\_System\_and\_Tokens.md through 06\_UI\_Phase\_by\_Phase\_Implementation\_Prompts.md) before writing code.

> **DO NOT** alter any backend APIs, MySQL schemas, SQLite sync engines, or business logic. All changes must be strictly aesthetic, layout, responsiveness, and component-level enhancements.

## **📂 File Map & Phased Roadmap**

| Filename | Purpose | Focus Area |
| :---- | :---- | :---- |
| 00\_README\_Index.md | Orientation Guide | Documentation index and agent rules |
| 01\_UI\_Design\_System\_and\_Tokens.md | Design Architecture | Color palettes, typography scale, CSS tokens, glassmorphism, contrast |
| 02\_Universal\_Responsiveness\_Rules.md | Screen Adaptability | Touch targets (44px), table overflow wrappers, grid auto-fit rules (320px to 4K) |
| 03\_Screen\_by\_Screen\_UI\_Specifications.md | Visual Layout Specs | Bento-grid layouts, HUDs, split views, modal portals for all 16+ app screens |
| 04\_Anti\_Bug\_Zero\_Regression\_Protocol.md | Safety Constraints | Rules to prevent breaking form state, background sync pollers, state hashes, or logic |
| 05\_Master\_Implementation\_Roadmap.md | Phased Execution Plan | Order of refactoring, testing criteria per phase, and verification harness |
| 06\_UI\_Phase\_by\_Phase\_Implementation\_Prompts.md | Executable Agent Prompts | Ready-to-copy structured prompts for step-by-step implementation in Antigravity |

## **🚀 How to Execute with AI Developer Tool**

1. Save these files into your repository root under ui\_redesign\_docs/ or context/ui\_redesign\_docs/.  
2. Open **Antigravity** (or your AI agent).  
3. Provide the executable prompts from 06\_UI\_Phase\_by\_Phase\_Implementation\_Prompts.md **one phase at a time**.  
4. Verify each phase with npm test and npm run build before moving to the next prompt phase.