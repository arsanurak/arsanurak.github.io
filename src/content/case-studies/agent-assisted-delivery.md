---
title: "Running infrastructure work through AI agents: decisions by me, execution by the agent"
summary: Grilling sessions and ADRs for the decisions, ready-for-agent tickets for the work, hooks that block secrets and dangerous commands, and a reviewed PR for every change.
slug: agent-assisted-delivery
order: 3
status: In use · evolving
area: AI coding agents, workflow, guardrails
decision: Keep decisions human and recorded, give the agent only well-specified tickets, enforce hard limits with hooks, and review every change in a pull request.
code: https://github.com/arsanurak/platform-demo
tags: [Claude Code, ADRs, Workflow]
---

## Context

The work is platform engineering for a small team: Terraform for cloud infrastructure, GitOps repositories that Argo CD syncs into Kubernetes clusters, and the tickets, decision records and reviews around them. Most changes are small and precise, a few are large and risky, and nearly all of them touch something that matters.

AI coding agents are now good enough to do much of the typing in this kind of work: reading a repository, drafting Terraform, writing a migration script, explaining a failing workflow. They are also fast, confident and occasionally wrong in ways that look right.

## Problem

Used casually, an agent blurs three lines that infrastructure work depends on.

The first is **who decided**. If the agent picks the design while it writes the code, the decision is never examined and never recorded. The second is **what it can touch**. An agent with shell access and ambient credentials can read a secret into its context or run a command against a live cluster. The third is **what got reviewed**. A large, plausible change produced in minutes is easy to accept without reading.

I wanted the speed without losing any of those lines: decisions made by me and written down, execution by the agent within hard limits, and every change reviewed before it lands.

## Constraints

- **Decisions stay human.** Architecture choices are made by me, with the reasoning recorded where the team can find it later.
- **No secrets in context.** The agent must not be able to read credentials, even by accident.
- **No direct changes to running infrastructure.** Clusters and cloud accounts change only through Git and CI, never from the agent's shell.
- **Everything reviewable.** Every change arrives as a pull request a person reads.
- **It has to be faster.** A process heavier than doing the work by hand would simply not be used.

## Options considered

1. **Chat assistant only.** Ask questions, copy answers into the editor. Safe, but slow, and nothing ties a suggestion to a decision or a review.
2. **An autonomous agent with broad access.** Fast, but it puts decisions, secrets and production one prompt away from each other.
3. **A structured workflow with hard limits.** Separate deciding from doing, hand the agent only work that is already decided, and enforce the limits in code rather than instructions. *This is the option I chose.*

## Decision and why

The workflow is built on [Matt Pocock's skills](https://github.com/mattpocock/skills), a set of agent skills for real engineering work. I use them as the backbone: **grilling** sessions where the agent questions a plan until the decision is clear, a domain glossary and Architecture Decision Records to keep the vocabulary and reasoning in the repository, specs broken into tickets, triage labels that mark each ticket `ready-for-agent` or `ready-for-human`, test-first implementation, and a two-axis code review against the repository's standards and the ticket's spec. Its setup step also gives each repository short agent docs: where its issues live, what its labels mean, and where its glossary and decision records are, so the agent follows that project's conventions instead of guessing.

The rule that holds it together is simple: the agent only picks up tickets labelled `ready-for-agent`. Anything still undecided goes back to grilling, and anything that needs credentials, a console or judgement about production stays `ready-for-human`.

```mermaid alt="An idea goes through a grilling session to a decision record and spec, then into tickets. Triage marks each ticket ready for the agent or ready for a human. The agent drafts the change behind guardrail hooks as a pull request. I review it, and only merged changes reach CI, which applies them." caption="Figure 1. Deciding and doing are separate steps, with a review between the agent and anything that runs."
flowchart TD
  IDEA[Idea or problem] -->|grilling| ADR[Decision record and spec]
  ADR --> TICKETS[Tickets]
  TICKETS -->|triage| AGENT[ready-for-agent]
  TICKETS -->|triage| HUMAN[ready-for-human]
  AGENT -->|drafts the change behind hooks| PR[Pull request]
  PR -->|my review| MERGE[Merge]
  MERGE --> CI[CI applies]
```

On top of the skills I added the limits that infrastructure work needs:

- **A secret-blocking hook.** It runs before every file read, search, edit and shell command, and denies anything that matches credential files, key files or commands that would echo a token. It is deterministic pattern matching, not a request the agent can talk its way past.
- **A command guard.** It runs before every shell command and denies cluster write operations, destructive commands, exfiltration patterns and writes to the GitOps repositories. When it blocks something, it tells the agent to hand the change back to me to run.
- **Scoped credentials.** The agent never holds credentials that can change infrastructure. Infrastructure changes reach the cloud only through CI, under the capped execution role described in [the guardrails case study](/case-studies/ci-pipeline-guardrails/).
- **A GitOps boundary.** In the GitOps repositories the guard also blocks commits and pushes, so the agent can draft a change there but I commit it myself after reading it.

## Rollout

The hooks live in the agent configuration that every session loads, so the limits apply whether or not a prompt mentions them. Each repository then got the skills' agent docs and the same triage labels, so a ticket means the same thing everywhere.

Decision records became a habit rather than an occasional document. Grilling turns a vague plan into a short record with the options and the reason, and an agent can draft that record in the repository's own format while the reasoning is still fresh.

This portfolio was built the same way: a map of open questions, grilling tickets that each ended in a recorded decision, a spec, and implementation tickets the agent picked up only once they were labelled `ready-for-agent`, each reviewed by me before it was pushed.

## Outcome

The agent does most of the typing; I make the decisions and read every change. Decision records get written while the reasoning is fresh, in the repository, where the next person can find them.

The hooks turn the boundaries from instructions into rules. The agent doesn't have to remember not to read a credential file or run a cluster write: the hook denies it before the command runs. When a task genuinely needs one of those actions, the block says so and the work comes back to me as a clear, reviewable step.

## What I'd do differently

> I'd write the domain glossary at the first grilling session, not after several. Without it, the agent drifts between synonyms for the same concept, and tickets and code end up using different words for one thing.
>
> I'd also test the hooks like any other code from the start, with cases for what they must block and what they must allow, instead of trusting a pattern list that only grows.

## See it in code

The demo repo is being built in public with this workflow: its own glossary and decision records, triage-labelled issues, a map of open questions, and pull requests co-authored by the agent and reviewed before merging. Its agent configuration, including the secret-blocking and command-guard hooks, is committed so the limits can be inspected.
