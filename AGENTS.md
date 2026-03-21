# AGENTS.md

## Project Status

This repository is a greenfield application. Assume there are no backwards-compatibility requirements unless the user explicitly asks for them.

## Change Guidelines

- Prefer the simplest design that fits the current codebase and product direction.
- Refactors may change APIs, data shapes, file layouts, and behavior when that improves the design.
- Update in-repo callers, tests, and docs in the same change instead of adding compatibility layers.
- Do not add deprecation shims, migration wrappers, or versioned fallbacks unless they are explicitly requested.

---

If @richie-router/* is not correct, or its API could be improved, let's update it in ~/project/richie-router and symlink the folders to the node_modules in this project
