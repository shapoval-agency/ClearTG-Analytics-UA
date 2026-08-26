# Universal Project Instructions

## 1. Understand the project first

Before changing code:

- Inspect the repository structure.
- Read relevant configuration files such as `package.json`, `tsconfig.json`, framework config, lint config, build scripts, README, and project documentation.
- Identify the actual stack, architecture, package manager, coding style, and available commands.
- Read the files directly related to the task before proposing changes.
- Do not assume the project uses React, Next.js, Node.js, WordPress, or static HTML until the repository confirms it.

## 2. Follow the existing architecture

- Reuse existing components, utilities, hooks, services, styles, and design tokens.
- Follow the naming, folder structure, formatting, and patterns already used in the project.
- Do not create duplicate components or parallel implementations when an existing solution can be extended.
- Do not introduce a new architectural pattern unless the current one cannot solve the task.
- Prefer the smallest maintainable change that fully solves the problem.

## 3. Protect the project

Do not change these unless the task explicitly requires it:

- public APIs
- database schemas
- environment variable names
- authentication logic
- routing structure
- URLs and slugs
- dependencies
- package manager
- build or deployment configuration
- analytics and tracking
- SEO metadata and structured data
- localization keys
- WordPress, ACF, WPML, or Polylang relationships

Never:

- expose secrets, tokens, passwords, or private keys
- hardcode credentials
- delete user data
- overwrite unrelated work
- run destructive database, Git, filesystem, or deployment commands without explicit approval

## 4. Stay within scope

- Make only changes needed for the current task.
- Do not refactor unrelated code.
- Do not rename files, variables, components, routes, or fields without a clear reason.
- Do not fix unrelated warnings unless they block the requested task.
- Preserve backward compatibility unless a breaking change is explicitly approved.
- If the task is ambiguous, inspect the project first and ask only the minimum necessary clarification.

## 5. Code quality

- Write readable, maintainable, production-ready code.
- Prefer simple solutions over clever abstractions.
- Keep functions and components focused.
- Avoid unnecessary dependencies.
- Avoid `any`, unsafe casts, suppressed errors, and disabled lint rules unless justified.
- Handle loading, empty, success, and error states where relevant.
- Add comments only where the reason is not obvious.
- Do not leave placeholder logic, fake data, unfinished TODOs, or commented-out dead code.

## 6. Frontend and UI

When changing UI:

- Preserve the existing visual language and design system.
- Reuse existing spacing, typography, colors, components, and breakpoints.
- Do not redesign unrelated areas.
- Check desktop, tablet, and mobile behavior.
- Prevent horizontal overflow and layout shifts.
- Preserve keyboard navigation and visible focus states.
- Use semantic HTML and accessible labels.
- Ensure forms show clear validation, loading, success, and error feedback.
- Do not claim visual accuracy unless it was actually verified.

## 7. React and Next.js

Apply only when the project uses React or Next.js:

- Follow the existing component and rendering strategy.
- Respect Server and Client Component boundaries.
- Do not add `"use client"` unless browser-only behavior requires it.
- Keep data fetching consistent with the project.
- Avoid unnecessary state, effects, and re-renders.
- Preserve metadata, canonical URLs, hreflang, sitemap behavior, and structured data.
- Do not move working server-rendered content to client-only rendering without a strong reason.

## 8. Static HTML, CSS, and JavaScript

Apply only to static or vanilla projects:

- Preserve semantic HTML and progressive enhancement.
- Reuse existing class naming and CSS organization.
- Avoid global CSS changes when a scoped solution is possible.
- Do not add a framework for a small task.
- Preserve the browser compatibility expected by the project.

## 9. Backend, APIs, and automation

When changing backend code or internal tools:

- Validate all external input.
- Handle failures and partial failures safely.
- Preserve idempotency for import, export, synchronization, and automation tasks.
- Add dry-run support for bulk updates where practical.
- Log useful outcomes without exposing sensitive data.
- Avoid silent data loss.
- For migrations or imports, provide a rollback or backup path.

## 10. WordPress and ACF

Apply only when WordPress is present:

- Preserve post IDs, slugs, statuses, taxonomies, media relationships, and translation links.
- Use existing ACF field names and structures.
- Do not change ACF field keys, repeater structures, or flexible content layouts unless explicitly required.
- For bulk imports, update only approved fields.
- Prefer matching existing records by stable IDs rather than titles or slugs.
- Require a backup and a small test batch before a full import.
- Do not create duplicate posts or translations.

## 11. Security

- Validate and sanitize user-controlled data.
- Escape output in the correct context.
- Preserve authorization checks.
- Do not weaken CORS, CSP, authentication, permissions, or input validation to make something work.
- Use parameterized queries or the project's safe database abstraction.
- Avoid exposing stack traces or sensitive internal information to users.

## 12. Verification

After making changes, run relevant commands that already exist in the project, such as:

- lint
- typecheck
- tests
- build

Also verify the changed behavior directly when possible.

Do not invent successful results. If a command cannot be run or fails:

- state exactly what was run
- show the relevant failure
- explain what remains unverified

Do not modify unrelated files merely to make checks pass.

## 13. Git safety

- Review `git diff` before finishing.
- Ensure no secrets, generated files, temporary files, or unrelated changes were added.
- Do not commit, push, merge, reset, rebase, or force-push unless explicitly requested.
- Do not discard existing uncommitted user changes.

## 14. Working style

For small, clear tasks:

- inspect
- implement
- verify
- summarize

For tasks affecting several files, architecture, data, security, SEO, or deployment:

- inspect the project
- produce a concise plan
- identify risks
- wait for approval before broad or destructive changes

If implementation reveals that the original plan is unsafe or incorrect, stop and explain before continuing.

## 15. Final response

At the end, provide:

1. What was changed.
2. Which files were changed.
3. What checks were run and their results.
4. Any remaining risks or manual steps.

Keep the summary factual and concise.
