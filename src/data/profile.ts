// The profile column and timeline copy for the home page.
// Content rules: employers by sector and location only, no phone number,
// rounded relative figures only, "I" for my decisions, "the team" for shared work.

export interface Link {
  href: string;
  label: string;
}

const linkedin: Link = {
  href: "https://www.linkedin.com/in/anurak-chatree-01a626136",
  label: "linkedin.com/in/anurak-chatree-01a626136",
};

export const profile = {
  name: "Anurak Chatree (Ars)",
  headline: "Senior Platform & DevOps Engineer",
  tagline: "Kubernetes, GitOps and AWS, debugged from the network layer up.",
  summary:
    "Since 2022 I've built and run production Kubernetes platforms: AWS EKS and Linode LKE, delivered through GitOps with Argo CD, with every major infrastructure choice recorded as an Architecture Decision Record. Before Kubernetes I spent over a decade designing Cisco networks, so service mesh, ingress, DNS and VPN problems are where I'm most useful. I've led small infrastructure teams, own disaster recovery planning, and use AI coding agents for incident diagnosis and PR review.",
  location: "Chiang Mai, Thailand (UTC+7) · Remote, or hybrid in Bangkok",
  linkedin,
  skills: [
    "Kubernetes",
    "AWS EKS",
    "Argo CD",
    "Terraform",
    "Karpenter",
    "Istio",
    "IAM & OIDC",
    "Prometheus",
    "Linux",
    "Cisco networking",
    "SRE practices",
  ],
  credentials: ["CCNP", "CCNA", "B.Eng. in Computer Engineering (Naresuan University)"],
};

export interface OtherWork {
  title: string;
  description: string;
}

export const otherWork: OtherWork[] = [
  {
    title: "An all-spot staging cluster with an honest cost model",
    description:
      "I ran a staging cluster entirely on Spot capacity with Karpenter, including the bootstrap nodes that most designs keep on demand. A node failure taught me where an all-spot design needs headroom, and my first cost estimate turned out about 20× low, so the cost model now says plainly what it leaves out.",
  },
  {
    title: "Architecture Decision Records as a practice",
    description:
      "Every major infrastructure choice gets a short decision record: about 35 so far, from cluster platforms to GitOps layout and access control. When a decision changes, the old record stays and a new one supersedes it in the open, so the reasoning behind today's setup can always be traced.",
  },
  {
    title: "Reorganising production apps into domain namespaces",
    description:
      "The team moved about 150 production apps into namespaces grouped by business domain, in batches, so that ownership, network policy and access rules line up with the domains.",
  },
  {
    title: "A service mesh beside the existing ingress",
    description:
      "I introduced Istio alongside the existing ingress rather than replacing it, so services could move onto the mesh gradually while the ingress kept serving everything else.",
  },
];

export interface Role {
  years: string;
  title: string;
  organisation?: string;
  summary?: string;
  current?: boolean;
}

// Newest first.
export const roles: Role[] = [
  {
    years: "2018–present",
    title: "DevOps & Platform Engineering",
    organisation: "Payments / fintech company, Chiang Mai",
    current: true,
  },
  {
    years: "2012–2018",
    title: "Network Engineer",
    organisation: "Software company, Chiang Mai",
    summary:
      "Ran systems and networks: monitoring for mail, Wi-Fi and LAN; network builds for new buildings; fault tolerance and backups.",
  },
  {
    years: "2010–2012",
    title: "Self-employed",
    organisation: "Own business, Chiang Mai",
  },
  {
    years: "2005–2010",
    title: "Senior Network Engineer / Team Lead",
    organisation: "Network systems integrator, Bangkok",
  },
  {
    years: "Earlier · 2004–2005",
    title: "Network and systems engineering roles",
  },
];

// The public Demo repo: the case-study concepts rebuilt as generic, runnable code.
export const demoRepo: Link = {
  href: "https://github.com/arsanurak/platform-demo",
  label: "arsanurak/platform-demo",
};

export interface Capability {
  name: string;
  proof: string;
  // Where a reviewer can check the claim. Empty when the work can't be shown.
  evidence: Link[];
}

const migrationStudy: Link = {
  href: "/case-studies/platform-migration-in-waves/",
  label: "Migration case study",
};
const guardrailsStudy: Link = {
  href: "/case-studies/ci-pipeline-guardrails/",
  label: "CI guardrails case study",
};
const agentStudy: Link = {
  href: "/case-studies/agent-assisted-delivery/",
  label: "Agent-assisted delivery case study",
};
const otherWorkLink: Link = { href: "#other-work", label: "Other work" };
const siteBuild: Link = { href: "/how-this-site-is-built/", label: "How this site is built" };
const timeline: Link = { href: "#work", label: "Work history" };
const demo = "https://github.com/arsanurak/platform-demo";
const demoMigration: Link = { href: `${demo}#tour-1-migrate-in-waves`, label: "Runnable demo" };
const demoGuardrails: Link = { href: `${demo}#tour-2-guardrails-without-credentials`, label: "Terraform demo" };
const demoWorkflow: Link = { href: `${demo}#tour-3-how-this-repo-was-built`, label: "Built in public" };

// "What I can do": capabilities in the words job posts use, each with one line of proof.
// Every line is confirmed by Ars before it ships.
export const capabilities: Capability[] = [
  {
    name: "Kubernetes platform operations",
    proof:
      "Production clusters on AWS EKS and Linode LKE since 2022. About 150 production apps reorganised into domain namespaces, and Istio introduced alongside the existing ingress.",
    evidence: [migrationStudy, otherWorkLink],
  },
  {
    name: "Cloud and platform migration",
    proof:
      "About a hundred services moved between Kubernetes platforms in dependency-ordered waves, each gated by an HTTP parity check, with rollback kept until the last wave.",
    evidence: [migrationStudy, demoMigration],
  },
  {
    name: "Infrastructure as code (Terraform)",
    proof: "AWS network, cluster and node provisioning in Terraform, planned on every pull request and applied on merge.",
    evidence: [guardrailsStudy, demoGuardrails],
  },
  {
    name: "GitOps and CI/CD",
    proof:
      "Argo CD for every cluster change, and GitHub Actions with OIDC and SHA-pinned actions. This site's own pipeline won't deploy anything that fails its checks.",
    evidence: [demoMigration, guardrailsStudy, siteBuild],
  },
  {
    name: "Cloud security and IAM",
    proof:
      "CI with no stored keys, a permission boundary the pipeline can't edit, an account split, and guardrails asserted as tests.",
    evidence: [guardrailsStudy, demoGuardrails],
  },
  {
    name: "Disaster recovery planning",
    proof:
      "I wrote the platform's disaster recovery plan: service tiers with recovery-time and data-loss targets, step-by-step recovery for zone failure, regional outage, database corruption, registry or Git outage and accidental mass deletion through GitOps, and a test plan. Migrations keep a one-step rollback until the old side is retired.",
    evidence: [migrationStudy],
  },
  {
    name: "Monitoring and logging",
    proof:
      "I set up and tune monitoring for production: uptime checks on every gateway, internal API and web app with alerts to the team's chat, and centralised logs from every pod through Filebeat, Elasticsearch and Kibana, with retention by lifecycle policy and long-term archive to S3.",
    evidence: [],
  },
  {
    name: "Networking and network security",
    proof:
      "Over a decade designing Cisco networks (CCNP), so ingress, DNS, VPN and service-mesh problems are where I'm most useful. A parity check caught a VPN-only route answering 403 before cutover.",
    evidence: [timeline, migrationStudy],
  },
  {
    name: "Security and compliance documentation",
    proof:
      "I wrote the platform's security and continuity documents for a regulated payments environment: business continuity, security baseline, incident detection and response, network access control, and protection of data at rest.",
    evidence: [],
  },
  {
    name: "Cost optimisation",
    proof: "An all-spot staging cluster on Karpenter, with a cost model that says plainly what it leaves out.",
    evidence: [otherWorkLink],
  },
  {
    name: "Architecture decisions and documentation",
    proof: "About 35 Architecture Decision Records, superseded in the open when a decision changes.",
    evidence: [otherWorkLink, agentStudy],
  },
  {
    name: "Team leadership and AI-assisted delivery",
    proof:
      "I've led small infrastructure teams, and I run infrastructure work through AI agents: recorded decisions, hook guardrails, and a reviewed pull request for every change.",
    evidence: [agentStudy, demoWorkflow],
  },
];
