'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, ShieldCheck, FileCheck2, Activity, Users, BookOpen, Settings2 } from 'lucide-react';
import { api, Notice, Empty } from './civic-app';
import { Button } from './ui/button';
import type { AdminData, Language, UserView, Reviewable } from '@/lib/types';
import { messages, statuses } from '@/lib/i18n';
export function AdminPanel({
  org,
  lang,
  user,
}: {
  org: string;
  lang: Language;
  user: UserView | null;
}) {
  const t = messages[lang],
    es = lang === 'es';
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [tab, setTab] = useState('overview'),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [type, setType] = useState('source'),
    [members, setMembers] = useState<{
      items: { roleId: string; user: { id: string; name: string; email: string } }[];
      roles: { id: string; name: string }[];
    } | null>(null);
  const can = (permission: string) =>
    !!user?.memberships.some(
      (m) =>
        data &&
        m.permissions.includes(permission) &&
        m.organizationId === (org === 'demo' ? 'org-demo' : 'org-apomatch'),
    );
  useEffect(() => {
    if (!user) return;
    let active = true;
    api<AdminData>('admin/dashboard', org)
      .then((d) => {
        if (active) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [org, user, refresh]);
  useEffect(() => {
    if (tab !== 'users') return;
    let active = true;
    api<NonNullable<typeof members>>('admin/members', org)
      .then((d) => {
        if (active) setMembers(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [tab, org, refresh]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(t.success);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function formData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget));
  }
  if (!user) return <Empty title={t.authRequired} />;
  if (!data)
    return (
      <div className="panel" aria-busy={!error}>
        <h1>{t.admin}</h1>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : (
          <div className="skeleton" />
        )}
      </div>
    );
  const tabs = [
    ['overview', es ? 'Resumen' : 'Overview', Activity],
    ['editorial', es ? 'Contenido editorial' : 'Editorial content', BookOpen],
    ['moderation', es ? 'Moderación' : 'Moderation', ShieldCheck],
    ['users', es ? 'Usuarios y roles' : 'Users & roles', Users],
    ['audit', es ? 'Auditoría' : 'Audit', FileCheck2],
    ['settings', es ? 'Integraciones' : 'Integrations', Settings2],
  ] as const;
  const reviewItems: { type: string; item: Reviewable }[] = [
    ...data.sources.map((item) => ({ type: 'source', item })),
    ...data.elections.map((item) => ({ type: 'election', item })),
    ...data.offices.map((item) => ({ type: 'office', item })),
    ...data.candidates.map((item) => ({ type: 'candidate', item })),
    ...data.proposals.map((item) => ({ type: 'proposal', item })),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">APOMATCH · {org.toUpperCase()}</span>
          <h1>{t.admin}</h1>
          <p>
            {es
              ? 'Permisos comprobados en el servidor. Revisión independiente antes de publicar.'
              : 'Permissions enforced on the server. Independent review before publishing.'}
          </p>
        </div>
      </div>
      <div className="admin-tabs">
        {tabs.map(([key, label, Icon]) => (
          <button
            className={tab === key ? 'selected' : ''}
            key={key}
            onClick={() => {
              setTab(key);
              setError('');
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {tab === 'overview' && (
        <>
          <div className="admin-stats">
            {Object.entries(data.stats).map(([key, n]) => (
              <div className="stat-card" key={key}>
                <strong className="stat-value">{n}</strong>
                <h3>
                  {
                    {
                      users: es ? 'Miembros administrativos' : 'Administrative members',
                      cities: es ? 'Ciudades' : 'Cities',
                      elections: es ? 'Elecciones verificadas' : 'Verified elections',
                      candidates: es ? 'Candidatos verificados' : 'Verified candidates',
                      issues: es ? 'Reportes' : 'Reports',
                      pending: es ? 'Fuentes pendientes' : 'Pending sources',
                    }[key]
                  }
                </h3>
              </div>
            ))}
          </div>
          <Notice>
            {es
              ? 'Los totales están limitados a esta organización. La cifra de usuarios cuenta miembros administrativos, no cuentas globales. Las listas operativas muestran hasta 100 registros.'
              : 'Totals are scoped to this organization. Users count administrative members, not global accounts. Operational lists show up to 100 records.'}
          </Notice>
        </>
      )}
      {tab === 'editorial' && (
        <div className="admin-layout">
          <section className="panel">
            <h2>
              <Plus size={19} />
              {es ? 'Agregar contenido' : 'Add content'}
            </h2>
            {can('content.write') ? (
              <>
                <label>
                  {es ? 'Tipo de contenido' : 'Content type'}
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    {['source', 'election', 'office', 'candidate', 'candidacy', 'proposal'].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <form
                  key={type}
                  className="form-stack"
                  onSubmit={(e) => {
                    const form = e.currentTarget;
                    const values = formData(e);
                    void act(async () => {
                      await api(
                        type === 'source' ? 'admin/sources' : 'admin/content',
                        org,
                        type === 'source' ? values : { type, data: values },
                      );
                      form.reset();
                    });
                  }}
                >
                  {type === 'source' && (
                    <>
                      <Field label={t.title} name="title" max={200} />
                      <Field label="URL (HTTPS)" name="url" kind="url" />
                      <label>
                        {es ? 'Tipo de fuente' : 'Source kind'}
                        <select name="kind">
                          {[
                            'GOVERNMENT',
                            'CANDIDATE',
                            'PUBLIC_RECORD',
                            ...(org === 'demo' ? ['DEMO'] : []),
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label={
                          es ? 'Extracto o afirmación que respalda' : 'Excerpt / supported claim'
                        }
                        name="excerpt"
                        multiline
                        max={6000}
                      />
                    </>
                  )}
                  {['election', 'office'].includes(type) && (
                    <label>
                      {es ? 'Jurisdicción' : 'Jurisdiction'}
                      <select name="jurisdictionId" required>
                        <option value="">—</option>
                        {data.jurisdictions.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {type === 'election' && (
                    <>
                      <Field label={t.name} name="name" max={200} />
                      <Field label={t.date} name="electionDate" kind="date" />
                    </>
                  )}
                  {type === 'office' && (
                    <>
                      <Field label={t.title} name="title" max={200} />
                      <Field
                        label={es ? 'Responsabilidades' : 'Responsibilities'}
                        name="responsibilities"
                        multiline
                        max={3000}
                      />
                    </>
                  )}
                  {type === 'candidate' && (
                    <>
                      <Field label={t.name} name="name" max={200} />
                      <Field
                        label={es ? 'Biografía documentada' : 'Documented biography'}
                        name="biography"
                        multiline
                        max={3000}
                      />
                    </>
                  )}
                  {type === 'candidacy' && (
                    <>
                      <label>
                        {es ? 'Candidato' : 'Candidate'}
                        <select name="candidateId" required>
                          <option value="">—</option>
                          {data.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es ? 'Elección' : 'Election'}
                        <select name="electionId" required>
                          <option value="">—</option>
                          {data.elections.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es ? 'Cargo' : 'Office'}
                        <select name="officeId" required>
                          <option value="">—</option>
                          {data.offices.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {type === 'proposal' && (
                    <>
                      <label>
                        {es ? 'Candidatura' : 'Candidacy'}
                        <select name="candidacyId" required>
                          <option value="">—</option>
                          {data.candidacies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.candidate.name} · {c.office.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es ? 'Tema' : 'Topic'}
                        <select name="topic">
                          {[
                            'cost-of-living',
                            'taxes',
                            'education',
                            'infrastructure',
                            'public-services',
                            'housing',
                            'safety',
                            'transport',
                            'health',
                          ].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label={es ? 'Propuesta documentada' : 'Documented proposal'}
                        name="text"
                        multiline
                        max={4000}
                      />
                    </>
                  )}
                  {!['source', 'candidacy'].includes(type) && (
                    <label>
                      {t.source}
                      <select name="sourceId" required>
                        <option value="">—</option>
                        {data.sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} · {s.status}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Button disabled={busy}>{es ? 'Enviar a revisión' : 'Submit for review'}</Button>
                </form>
              </>
            ) : (
              <Notice>
                {es ? 'Tu rol no permite crear contenido.' : 'Your role cannot create content.'}
              </Notice>
            )}
          </section>
          <section className="panel review-queue">
            <h2>{t.publish}</h2>
            {reviewItems.map(({ type, item }) => (
              <div className="review-item" key={`${type}-${item.id}`}>
                <span className="eyebrow">
                  {type} · {item.status}
                </span>
                <h3>{item.title || item.name || item.text}</h3>
                <code>{item.id}</code>
                {can('content.verify') && (
                  <form
                    className="form-stack"
                    onSubmit={(e) => {
                      const values = formData(e);
                      void act(() =>
                        api('admin/reviews', org, {
                          ...values,
                          entityType: type,
                          entityId: item.id,
                        }),
                      );
                    }}
                  >
                    <label>
                      {t.status}
                      <select name="status">
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="IN_REVIEW">IN_REVIEW</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </label>
                    <Field
                      label={es ? 'Nota del verificador' : 'Reviewer note'}
                      name="note"
                      max={2000}
                    />
                    <Button variant="outline" disabled={busy}>
                      {es ? 'Registrar revisión' : 'Record review'}
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === 'moderation' && (
        <div className="stack">
          {data.queue.length ? (
            data.queue.map((i) => (
              <article className="panel" key={i.id}>
                <div className="section-heading">
                  <h2>{i.title}</h2>
                  <span className="badge">
                    {i.published ? 'PUBLIC' : 'PRIVATE'} · {i.status}
                  </span>
                </div>
                <p>{i.description}</p>
                <p className="muted">{i.approximateLocation}</p>
                {can('issues.moderate') && (
                  <form
                    className="form-stack"
                    onSubmit={(e) => {
                      const values = formData(e);
                      void act(() =>
                        api(
                          'admin/issues',
                          org,
                          {
                            id: i.id,
                            status: values.status,
                            published: values.published === 'on',
                            note: values.note,
                            ...(values.responsibleAuthority
                              ? { responsibleAuthority: values.responsibleAuthority }
                              : {}),
                            ...(values.sourceId ? { sourceId: values.sourceId } : {}),
                          },
                          'PATCH',
                        ),
                      );
                    }}
                  >
                    <div className="form-two">
                      <label>
                        {t.status}
                        <select name="status" defaultValue={i.status}>
                          {Object.entries(statuses[lang]).map(([k, v]) => (
                            <option value={k} key={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {es
                          ? 'Autoridad responsable documentada (opcional)'
                          : 'Documented responsible authority (optional)'}
                        <input name="responsibleAuthority" maxLength={200} />
                      </label>
                    </div>
                    <label>
                      {es
                        ? 'Fuente de la actuación (obligatoria para remitido, en progreso o resuelto)'
                        : 'Evidence source (required for referred, in progress or resolved)'}
                      <select name="sourceId">
                        <option value="">—</option>
                        {data.sources
                          .filter((s) => s.status === 'VERIFIED')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Field
                      label={es ? 'Nota pública' : 'Public note'}
                      name="note"
                      multiline
                      max={2000}
                    />
                    <label className="checkbox-label">
                      <input name="published" type="checkbox" defaultChecked={i.published} />
                      {es
                        ? 'Publicar reporte tras revisión de datos personales y abusos'
                        : 'Publish after reviewing for personal data and abuse'}
                    </label>
                    <Button disabled={busy}>{t.save}</Button>
                  </form>
                )}
              </article>
            ))
          ) : (
            <Empty title={t.emptyIssues} />
          )}
        </div>
      )}
      {tab === 'users' && (
        <section className="panel">
          <h2>{es ? 'Miembros de la organización' : 'Organization members'}</h2>
          {members && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.name}</th>
                      <th>{t.email}</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.items.map((m) => (
                      <tr key={m.user.id}>
                        <td>{m.user.name}</td>
                        <td>{m.user.email}</td>
                        <td>{m.roleId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  const values = formData(e);
                  void act(() => api('admin/members', org, values));
                }}
              >
                <Field label={t.email} name="email" kind="email" />
                <label>
                  Role
                  <select name="roleId">
                    {members.roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button disabled={busy}>{t.save}</Button>
              </form>
            </>
          )}
        </section>
      )}
      {tab === 'audit' && (
        <section className="panel table-wrap">
          <table>
            <caption>
              {es ? 'Últimas 50 acciones administrativas' : 'Latest 50 administrative actions'}
            </caption>
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{es ? 'Acción' : 'Action'}</th>
                <th>{es ? 'Entidad' : 'Entity'}</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLogs.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString()}</td>
                  <td>{a.action}</td>
                  <td>
                    {a.entityType}: <code>{a.entityId}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === 'settings' && (
        <div className="cards-grid">
          {Object.entries(data.integrations).map(([key, value]) => (
            <article className="panel" key={key}>
              <span className="eyebrow">{key}</span>
              <h2>{value}</h2>
            </article>
          ))}
          <Notice>
            {es
              ? 'La configuración operativa se define mediante variables de entorno y no expone secretos en este panel. IA, imágenes y facturación permanecen desactivadas salvo configuración explícita.'
              : 'Operational configuration is defined through environment variables. Secrets are never exposed in this panel. AI, images and billing remain disabled unless explicitly configured.'}
          </Notice>
        </div>
      )}
    </>
  );
}
function Field({
  label,
  name,
  multiline = false,
  kind = 'text',
  max = 2000,
}: {
  label: string;
  name: string;
  multiline?: boolean;
  kind?: string;
  max?: number;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea name={name} required rows={3} maxLength={max} />
      ) : (
        <input name={name} required type={kind} maxLength={max} />
      )}
    </label>
  );
}
