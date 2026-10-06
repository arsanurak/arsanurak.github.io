// The profile column and timeline copy for the home page.
// Content rules: employers by sector and location only, no phone number,
// rounded relative figures only, "I" for my decisions, "the team" for shared work.

export const profile = {
  name: "Anurak Chatree (Ars)",
  headline: "Senior Platform & DevOps Engineer",
  tagline: "Kubernetes, GitOps and AWS, debugged from the network layer up.",
  summary:
    "Since 2022 I've built and run production Kubernetes platforms: AWS EKS and Linode LKE, delivered through GitOps with Argo CD, with every major infrastructure choice recorded as an Architecture Decision Record. Before Kubernetes I spent over a decade designing Cisco networks, so service mesh, ingress, DNS and VPN problems are where I'm most useful. I've led small infrastructure teams, own disaster recovery planning, and use AI coding agents for incident diagnosis and PR review.",
  location: "Chiang Mai, Thailand (UTC+7) · Remote, or hybrid in Bangkok",
  email: "ars.astore@gmail.com",
  linkedin: {
    href: "https://www.linkedin.com/in/anurak-chatree-01a626136",
    label: "linkedin.com/in/anurak-chatree-01a626136",
  },
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
    title: "Systems & Network Engineer",
    organisation: "Software company, Chiang Mai",
    summary:
      "Ran systems and networks: monitoring for mail, Wi-Fi and LAN; network builds for new buildings; fault tolerance and backups.",
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
