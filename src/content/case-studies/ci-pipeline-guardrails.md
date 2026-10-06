---
title: A CI pipeline that can't loosen its own guardrails
summary: OIDC instead of stored keys, a permission boundary the pipeline can't edit, an account split, and the AWS IAM limits that only testing revealed.
slug: ci-pipeline-guardrails
order: 2
status: Done · in use
area: AWS IAM, Terraform, GitHub Actions
decision: One OIDC-federated execution role for every apply, capped by a permission boundary it cannot edit, in an account of its own, with guardrails asserted as tests in CI.
code: https://github.com/arsanurak/platform-demo
tags: [Terraform, AWS IAM, GitHub Actions]
---

## Context

The system is the infrastructure-as-code layer for a Kubernetes environment on AWS: Terraform for the network, the cluster and node provisioning, applied from GitHub Actions. Changes arrive as pull requests, a plan runs on every PR, and an apply runs when a change is merged.

Whatever identity runs that apply holds real power. It can create IAM roles, attach policies and change networking. If it is broad, one wrong variable, one mistyped ARN or one careless `-target` reaches resources it was never meant to touch.

## Problem

Giving CI credentials is easy: store an access key as a repository secret. That key never expires, can be copied out of a log or a compromised runner, and is usually far broader than any single apply needs.

The subtler problem is that the pipeline manages IAM. A pipeline that can create roles and edit policies can, in principle, edit the role it runs as. A routine-looking pull request could quietly widen its own permissions, and the next apply would hand that wider access to everything that followed. I wanted a pipeline that could do its job and could not, by design, loosen the limits placed on it.

## Constraints

- **No stored keys.** CI authenticates with short-lived credentials only, issued per run.
- **The pipeline still manages IAM.** It must create roles for the cluster and its controllers, so IAM can't simply be taken away from it.
- **Guardrails can't depend on review alone.** Plan review catches a lot, but the hard limits had to hold even if a bad change got through.
- **Checks without credentials.** Most of the verification had to run in CI without a live cloud account.

## Options considered

1. **A stored access key with a scoped policy.** Simple, but the key is long-lived and the policy is only as safe as whoever edits it next.
2. **Tag-based access control alone.** Elegant where it works, but many create calls can't be restricted by tag until the resource already exists, so it can't stand on its own.
3. **An OIDC-federated execution role, capped by a permission boundary, with its own guardrails kept out of the pipeline's reach.** More setup, but every limit is enforced by IAM itself, not by convention. *This is the option I chose.*

## Decision and why

Every apply runs as one dedicated execution role. GitHub Actions gets it through OIDC: each run receives a short-lived token, and the role's trust policy accepts only tokens from this repository: runs on its two long-lived branches, and its pull-request runs. There is no key to leak.

The role's permissions are restricted by resource name wherever AWS supports it, and by tags where creation calls have nothing to name yet. Underneath sits a permission boundary, a hard ceiling that applies whatever the attached policies say. The boundary is attached to the execution role itself, and the role may only create new roles if they carry the same boundary. Nothing the pipeline creates can be more powerful than the pipeline.

```mermaid alt="A GitHub Actions run uses a short-lived OIDC token to assume the execution role. A permission boundary caps the role, a guardrail denies it editing itself or its boundary, and every role it creates must carry the same boundary." caption="Figure 1. The trust chain: no stored keys, one capped role, and guardrails the role can't edit."
flowchart TD
  GH[GitHub Actions run] -->|short-lived OIDC token| ROLE[Execution role]
  BOUND[Permission boundary] -.->|caps| ROLE
  GUARD[Guardrail: no edits to own role or boundary] -.->|denies| ROLE
  ROLE -->|creates, boundary required| NEW[Cluster and controller roles]
```

The trust root is bootstrapped by hand, once. The role, its policy, its boundary, its trust relationship and the Terraform state backend are created out of band, not by the pipeline. A role can't grant itself its initial authority, and letting it manage its own guardrails would let a routine pull request loosen them. Changes to that root go through a separate, reviewed path.

Two guardrails sit on top. One denies the execution role any change to itself or its boundary. The other is an organisation-level policy that blocks payment-method changes in the account, so the billing set-up can't be altered from inside it.

## Rollout

I wrote the policies alongside tests. For each guardrail, IAM policy-simulator matrices check which actions should be allowed on which resources and which must be denied, and pytest checks assert the guardrail properties on the rendered policy JSON. These run in CI on every change to the policies.

Testing against real IAM behaviour, and wiring the workflows to it, found the limits that shaped the design:

- **Some actions can't be scoped by resource at all.** A few cluster-creation actions have no resource-level support, so they are granted broadly and rely on plan review.
- **The boundary condition doesn't apply everywhere.** It works on role creation but has no meaning on creating a standalone managed policy, so the escalation guard is narrower than "every IAM create call".
- **Pull-request tokens carry no branch.** A PR run's subject claim names the event, not a branch, so the trust policy needed a separate entry for PR runs. The workflow's own triggers enforce which branches qualify.
- **Policy size is finite.** The identity policy reached IAM's size limit, so data-store permissions moved into a second managed policy on the same role.

Then the account split. One identity-provider action could only be scoped by an ARN pattern that also matched an existing provider belonging to another environment. I closed that case with an explicit deny, but it was reactive: the same class of gap could exist in a resource type nobody had touched yet. So I moved the environment into an account of its own. An account boundary closes the whole class at once.

## Outcome

The pipeline runs with no stored keys. Every apply happens under one role whose ceiling it can't raise, in an account that holds only this environment, and the guardrails are asserted by tests rather than remembered.

The most instructive failure came at the end. The first live run from GitHub failed to assume the role at all. The trust policy matched GitHub's documented subject format, but the organisation had turned on GitHub's option to put immutable repository and owner IDs in the subject claim. AWS's error said only "access denied". The audit log's failed event, which records the claims actually presented, showed the real subject, and the fix was to correct the subject values in the trust policy.

## What I'd do differently

> I'd test the trust policy against a real GitHub-issued token on day one, not after everything else was in place. Organisation-level settings can make a trust policy that looks correct against the documentation fail every time, and only a live run proves it works.
>
> I'd also start in a dedicated account instead of moving there later. The account boundary was the simplest guardrail in the end, and the bootstrap had to be redone once because of it.

## See it in code

The demo repo rebuilds this design from scratch in Terraform: an OIDC execution role, a permission boundary capping it, the GitHub OIDC trust, and guardrail policies that deny the role editing itself and lock out payment-method changes. One command runs every infrastructure check without AWS credentials, including the pytest checks on the rendered policies, and an opt-in job runs the policy-simulator matrices only when credentials exist. Nothing in it is copied from the system described here.
