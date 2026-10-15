export type Language = 'en' | 'es';
export interface SourceView {
  revision?: number;
  id: string;
  title: string;
  url: string;
  kind: string;
  status: string;
  verifiedAt: string | null;
  retrievedAt: string;
  excerpt?: string;
}
export interface CityView {
  id: string;
  name: string;
  isDemo: boolean;
  county: { name: string; state: { name: string; abbreviation: string } };
  zipCodes: { zipCode: string }[];
  jurisdictions: { id: string; name: string; kind: string; verificationStatus: string }[];
}
export interface UserView {
  id: string;
  name: string;
  email: string;
  memberships: { organizationId: string; roleId: string; permissions: string[] }[];
}
export interface IssueView {
  id: string;
  title: string;
  description: string;
  approximateLocation: string;
  category: string;
  status: string;
  isDemo: boolean;
  published?: boolean;
  responsibleAuthority: string | null;
  createdAt: string;
  updates: {
    id: string;
    status: string;
    note: string;
    createdAt: string;
    source?: SourceView | null;
  }[];
}
export interface OfficeView {
  id: string;
  title: string;
  responsibilities: string;
  source: SourceView;
}
export interface ProposalView {
  id: string;
  topic: string;
  text: string;
  status: string;
  verifiedAt: string | null;
  source: SourceView;
}
export interface ElectionView {
  id: string;
  name: string;
  electionDate: string;
  status: string;
  verifiedAt: string | null;
  source: SourceView;
  jurisdiction: string;
  candidacies: {
    id: string;
    candidate: {
      id: string;
      name: string;
      biography: string;
      statements: { text: string; source: SourceView }[];
    };
    office: OfficeView;
    proposals: ProposalView[];
  }[];
}
export interface GroupView {
  id: string;
  name: string;
  ownerId: string;
  cityId: string;
  _count: { memberships: number };
  events: {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    officialResourceUrl?: string;
  }[];
}
export interface Reviewable {
  id: string;
  name?: string;
  title?: string;
  text?: string;
  status: string;
  createdById?: string | null;
}
export interface AdminData {
  stats: Record<string, number>;
  sources: SourceView[];
  queue: IssueView[];
  auditLogs: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }[];
  elections: Reviewable[];
  offices: Reviewable[];
  candidates: Reviewable[];
  proposals: Reviewable[];
  jurisdictions: { id: string; name: string }[];
  candidacies: { id: string; candidate: { name: string }; office: { title: string } }[];
  integrations: Record<string, string>;
}
