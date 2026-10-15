import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const verifiedAt = new Date('2026-10-15T18:00:00.000Z');
const permissions = [
  'admin.read',
  'content.write',
  'content.verify',
  'issues.moderate',
  'users.manage',
];
export async function seed() {
  for (const permission of permissions)
    await db.permission.upsert({
      where: { id: permission },
      update: {},
      create: { id: permission },
    });
  for (const [id, name, grants] of [
    ['super-admin', 'Super Admin', permissions],
    ['editor', 'Editor', ['admin.read', 'content.write']],
    ['verifier', 'Verifier', ['admin.read', 'content.verify']],
    ['moderator', 'Moderator', ['admin.read', 'issues.moderate']],
  ] as const) {
    await db.role.upsert({ where: { id }, update: {}, create: { id, name } });
    for (const permissionId of grants)
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: id, permissionId } },
        update: {},
        create: { roleId: id, permissionId },
      });
  }
  await db.organization.upsert({
    where: { id: 'org-apomatch' },
    update: {},
    create: { id: 'org-apomatch', slug: 'apomatch', name: 'ApoMatch Pilot' },
  });
  await db.organization.upsert({
    where: { id: 'org-demo' },
    update: {},
    create: {
      id: 'org-demo',
      slug: 'demo',
      name: 'ApoMatch Fictional Demonstration',
      isDemo: true,
    },
  });
  await db.state.upsert({
    where: { id: 'us-ne' },
    update: {},
    create: { id: 'us-ne', name: 'Nebraska', abbreviation: 'NE' },
  });
  await db.county.upsert({
    where: { id: 'us-ne-nemaha' },
    update: {},
    create: { id: 'us-ne-nemaha', name: 'Nemaha', stateId: 'us-ne' },
  });
  await db.city.upsert({
    where: { id: 'us-ne-auburn' },
    update: {},
    create: {
      id: 'us-ne-auburn',
      name: 'Auburn',
      countyId: 'us-ne-nemaha',
      zipCodes: { create: { zipCode: '68305' } },
    },
  });
  await db.city.upsert({
    where: { id: 'demo-city' },
    update: {},
    create: {
      id: 'demo-city',
      name: 'Demo City (fictional)',
      countyId: 'us-ne-nemaha',
      isDemo: true,
      zipCodes: { create: { zipCode: '00000' } },
    },
  });
  const curated = [
    {
      id: 'source-auburn',
      title: 'City of Auburn — City Hall',
      url: 'https://auburn.ne.gov/city-hall/',
      excerpt:
        'Auburn is in Nemaha County and has an elected mayor and city council. City Hall publishes government information, council agendas and ward resources.',
    },
    {
      id: 'source-ne-elections',
      title: 'Nebraska Secretary of State — 2026 elections',
      url: 'https://sos.nebraska.gov/elections',
      excerpt:
        'The Secretary of State lists November 3, 2026 as the general election date. Follow the official page for the current candidate certification and election calendar.',
    },
    {
      id: 'source-nemaha',
      title: 'Nemaha County — Election Office',
      url: 'https://nemahacountyne.gov/election-office/',
      excerpt:
        'The county election office administers county elections and voter registration. Its page provides official notices and early voting resources.',
    },
    {
      id: 'source-voter-info',
      title: 'Nebraska Secretary of State — Elections Division',
      url: 'https://sos.nebraska.gov/elections-division',
      excerpt:
        'Official access point for voter information lookup, registration, voter ID information and voting deadlines. ApoMatch does not determine eligibility or polling places.',
    },
    {
      id: 'source-city-maps',
      title: 'City of Auburn — Maps',
      url: 'https://auburn.ne.gov/city-hall/maps/',
      excerpt:
        'Official municipal map resource. No district boundary geometry has been imported; a ZIP code must not be used to infer ward or district eligibility.',
    },
  ];
  for (const data of curated) {
    await db.source.upsert({
      where: { id: data.id },
      update: {},
      create: {
        ...data,
        organizationId: 'org-apomatch',
        status: 'VERIFIED',
        verifiedAt,
        retrievedAt: verifiedAt,
        createdById: 'seed:official-research-2026-10-15',
        verifications: {
          create: {
            reviewerId: 'seed:official-research-2026-10-15',
            status: 'VERIFIED',
            note: 'Source manually consulted during pilot implementation. See docs/pilot-sources.md; review before live use.',
            revision: 1,
            snapshot: data,
          },
        },
      },
    });
  }
  for (const [id, name, kind, sourceUrl] of [
    ['jur-auburn', 'City of Auburn', 'municipal', 'https://auburn.ne.gov/city-hall/'],
    ['jur-nemaha', 'Nemaha County', 'county', 'https://nemahacountyne.gov/election-office/'],
    ['jur-ne', 'Nebraska statewide', 'state', 'https://sos.nebraska.gov/elections'],
  ])
    await db.jurisdiction.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        kind,
        cityId: 'us-ne-auburn',
        sourceUrl,
        verificationStatus: 'VERIFIED',
        verifiedAt,
      },
    });
  await db.election.upsert({
    where: { id: 'ne-general-2026' },
    update: {},
    create: {
      id: 'ne-general-2026',
      organizationId: 'org-apomatch',
      jurisdictionId: 'jur-ne',
      name: 'Nebraska General Election 2026',
      electionDate: new Date('2026-11-03'),
      sourceId: 'source-ne-elections',
      status: 'VERIFIED',
      verifiedAt,
      createdById: 'seed:official-research-2026-10-15',
    },
  });
  for (const [id, title, responsibilities] of [
    [
      'office-auburn-mayor',
      'Auburn Mayor',
      'Elected municipal executive within the mayor–council government. Consult the city ordinances and official municipal records for the scope of each decision.',
    ],
    [
      'office-auburn-council',
      'Auburn City Council',
      'Elected municipal council. Consult the official city agenda, ordinances and budget records for decisions and the responsibilities of the body.',
    ],
  ])
    await db.office.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title,
        responsibilities,
        organizationId: 'org-apomatch',
        jurisdictionId: 'jur-auburn',
        sourceId: 'source-auburn',
        status: 'VERIFIED',
        verifiedAt,
        createdById: 'seed:official-research-2026-10-15',
      },
    });
  await db.jurisdiction.upsert({
    where: { id: 'jur-demo' },
    update: {},
    create: {
      id: 'jur-demo',
      name: 'Demo municipal jurisdiction (fictional)',
      kind: 'demo',
      cityId: 'demo-city',
      sourceUrl: 'https://example.org/apomatch-demo',
      verificationStatus: 'VERIFIED',
      verifiedAt,
    },
  });
  await db.source.upsert({
    where: { id: 'source-demo' },
    update: {},
    create: {
      id: 'source-demo',
      organizationId: 'org-demo',
      title: 'Fictional demo fixture — not an official record',
      url: 'https://example.org/apomatch-demo',
      kind: 'DEMO',
      excerpt:
        'All people, proposals, issues and authorities in the demonstration organization are fictional software fixtures. This URL is illustrative, not evidence about an election.',
      status: 'VERIFIED',
      verifiedAt,
      retrievedAt: verifiedAt,
    },
  });
  await db.election.upsert({
    where: { id: 'election-demo' },
    update: {},
    create: {
      id: 'election-demo',
      organizationId: 'org-demo',
      jurisdictionId: 'jur-demo',
      name: 'Fictional demonstration election',
      electionDate: new Date('2026-11-03'),
      sourceId: 'source-demo',
      status: 'VERIFIED',
      verifiedAt,
    },
  });
  await db.office.upsert({
    where: { id: 'office-demo' },
    update: {},
    create: {
      id: 'office-demo',
      organizationId: 'org-demo',
      jurisdictionId: 'jur-demo',
      title: 'Demo City Council (fictional)',
      responsibilities:
        'Fictional municipal office used to demonstrate sourced comparison and editorial workflow.',
      sourceId: 'source-demo',
      status: 'VERIFIED',
      verifiedAt,
    },
  });
  for (const [key, name, proposal] of [
    [
      'a',
      'Demo Candidate A (fictional)',
      'Fictional proposal: publish a quarterly street-maintenance schedule.',
    ],
    [
      'b',
      'Demo Candidate B (fictional)',
      'Fictional proposal: publish an annual infrastructure inspection report.',
    ],
  ]) {
    await db.candidate.upsert({
      where: { id: `candidate-demo-${key}` },
      update: {},
      create: {
        id: `candidate-demo-${key}`,
        organizationId: 'org-demo',
        name,
        biography: 'Fictional person created for software testing only.',
        status: 'VERIFIED',
        verifiedAt,
        statements: {
          create: {
            text: 'Fictional biography fixture, not a real person.',
            sourceId: 'source-demo',
            status: 'VERIFIED',
          },
        },
      },
    });
    await db.candidacy.upsert({
      where: { id: `candidacy-demo-${key}` },
      update: {},
      create: {
        id: `candidacy-demo-${key}`,
        candidateId: `candidate-demo-${key}`,
        electionId: 'election-demo',
        officeId: 'office-demo',
      },
    });
    await db.proposal.upsert({
      where: { id: `proposal-demo-${key}` },
      update: {},
      create: {
        id: `proposal-demo-${key}`,
        candidacyId: `candidacy-demo-${key}`,
        topic: 'infrastructure',
        text: proposal,
        sourceId: 'source-demo',
        status: 'VERIFIED',
        verifiedAt,
      },
    });
  }
  for (const [id, title, category, status, description] of [
    [
      'demo-issue-1',
      'Fictional street maintenance request',
      'STREETS',
      'REPORTED',
      'Demonstration report about a fictional intersection. No real defect is alleged.',
    ],
    [
      'demo-issue-2',
      'Fictional park lighting follow-up',
      'LIGHTING',
      'IN_REVIEW',
      'Demonstration of platform moderation. No government action is asserted.',
    ],
    [
      'demo-issue-3',
      'Fictional park path repair',
      'PARKS',
      'RESOLVED',
      'Fictional resolved issue. The associated evidence is a demo fixture, not an official record.',
    ],
  ] as const)
    await db.communityIssue.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title,
        category,
        status,
        description,
        approximateLocation: 'Fictional public intersection, Demo City',
        organizationId: 'org-demo',
        cityId: 'demo-city',
        isDemo: true,
        published: true,
        updates: {
          create: [
            { status: 'REPORTED', note: 'Fictional report received by the platform.' },
            ...(status !== 'REPORTED'
              ? [
                  {
                    status,
                    note: 'Fictional demonstration status only.',
                    sourceId: status === 'RESOLVED' ? 'source-demo' : undefined,
                  },
                ]
              : []),
          ],
        },
      },
    });
  await db.calculationModel.upsert({
    where: { id: 'property-tax-v1' },
    update: {},
    create: {
      id: 'property-tax-v1',
      name: 'Hypothetical property tax',
      version: 1,
      formula:
        'annualUSD = round(taxableValueUSD * ratePercent / 100, 2); differenceUSD = scenarioAnnualUSD - currentAnnualUSD',
      assumptions:
        'Constant taxable value; no exemptions, credits, assessment changes or other taxes. All rates are hypothetical.',
      sourceUrl: 'https://example.org/apomatch-hypothetical-model',
      isHypothetical: true,
    },
  });
  console.log(
    'Pilot sources and isolated fictional demo seeded. No real candidates imported. No accounts or passwords created.',
  );
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
