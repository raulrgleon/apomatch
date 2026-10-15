'use client';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Landmark,
  LayoutDashboard,
  Route,
  BookOpen,
  Scale,
  Calculator,
  Users,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock3,
  ChevronRight,
  LogIn,
  Bell,
  Leaf,
  FileCheck2,
  Globe2,
  CircleHelp,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import { messages, categories, statuses, topicKeys, topicLabels } from '@/lib/i18n';
import type {
  Language,
  CityView,
  UserView,
  IssueView,
  ElectionView,
  OfficeView,
  SourceView,
  GroupView,
} from '@/lib/types';
import { propertyTax } from '@/lib/calculations';
import { AdminPanel } from './admin-panel';
export async function api<T>(
  path: string,
  org: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const res = await fetch(
    `/api/${path}${path.includes('?') ? '&' : '?'}org=${encodeURIComponent(org)}`,
    {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    },
  );
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'SERVICE_UNAVAILABLE');
  return result as T;
}
export function SourceLink({ source, lang }: { source: SourceView; lang: Language }) {
  return (
    <div className="source-link">
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        <FileCheck2 size={14} />
        {source.title}
        <ExternalLink size={12} />
      </a>
      <span>
        {messages[lang].checked}:{' '}
        {source.verifiedAt
          ? new Date(source.verifiedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-US', {
              timeZone: 'UTC',
            })
          : messages[lang].pending}
      </span>
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <ShieldCheck size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Leaf size={24} />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
const nav = [
  { id: 'home', icon: LayoutDashboard },
  { id: 'community', icon: Route },
  { id: 'elections', icon: BookOpen },
  { id: 'compare', icon: Scale },
  { id: 'impact', icon: Calculator },
  { id: 'groups', icon: Users },
] as const;
export function CivicApp({ route }: { route: string }) {
  const [lang, setLang] = useState<Language>('en'),
    [dark, setDark] = useState(false),
    [menu, setMenu] = useState(false),
    [org, setOrg] = useState('apomatch'),
    [city, setCity] = useState<CityView | null>(null),
    [user, setUser] = useState<UserView | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [issues, setIssues] = useState<{ items: IssueView[]; total: number; page: number }>({
      items: [],
      total: 0,
      page: 1,
    }),
    [elections, setElections] = useState<ElectionView[]>([]),
    [offices, setOffices] = useState<OfficeView[]>([]),
    [sources, setSources] = useState<SourceView[]>([]),
    [sourceTotal, setSourceTotal] = useState(0),
    [sourcePage, setSourcePage] = useState(1),
    [query, setQuery] = useState(''),
    [searchResult, setSearchResult] = useState<CityView[] | null>(null),
    [searchBusy, setSearchBusy] = useState(false);
  const t = messages[lang];
  useEffect(() => {
    const stored = localStorage.getItem('apomatch-language');
    if (stored === 'en' || stored === 'es') setLang(stored);
    setDark(localStorage.getItem('apomatch-theme') === 'dark');
    const p = new URLSearchParams(window.location.search);
    if (p.get('org') === 'demo') setOrg('demo');
    setReady(true);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('apomatch-language', lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('apomatch-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api<{ cities: CityView[] }>('locations', org),
      api<{ user: UserView | null }>('auth/me', org),
    ])
      .then(([locations, session]) => {
        if (!active) return;
        setCity(locations.cities[0] || null);
        setUser(session.user);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [org, ready, refresh]);
  useEffect(() => {
    if (!city) return;
    let active = true;
    Promise.all([
      api<typeof issues>(`issues?city=${city.id}`, org),
      api<{ elections: ElectionView[]; offices: OfficeView[] }>(`elections?city=${city.id}`, org),
      api<{ items: SourceView[]; total: number }>(`sources?page=${sourcePage}`, org),
    ])
      .then(([i, e, s]) => {
        if (active) {
          setIssues(i);
          setElections(e.elections);
          setOffices(e.offices);
          setSources(s.items);
          setSourceTotal(s.total);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
    // The query's own result type is stable; fetching does not depend on prior issues.
  }, [city, org, refresh, sourcePage]);
  const href = (page: string) =>
    `${page === 'home' ? '/' : `/${page}`}${org === 'demo' ? '?org=demo' : ''}`;
  const reload = () => setRefresh((v) => v + 1);
  async function searchLocation(e: FormEvent) {
    e.preventDefault();
    setSearchBusy(true);
    try {
      const r = await api<{ cities: CityView[] }>(`locations?q=${encodeURIComponent(query)}`, org);
      setSearchResult(r.cities);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchBusy(false);
    }
  }
  const authLink = (
    <Button asChild variant="outline">
      <Link href={href('login')}>
        <LogIn size={16} />
        {t.login}
      </Link>
    </Button>
  );
  const locationForm = (
    <form className="location-form" onSubmit={searchLocation}>
      <label className="sr-only" htmlFor="location-search">
        {t.location}
      </label>
      <MapPin size={18} />
      <input
        id="location-search"
        placeholder={t.placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={100}
      />
      <Button disabled={searchBusy}>
        <Search size={16} />
        {t.search}
      </Button>
    </form>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {lang === 'en' ? 'Skip to content' : 'Ir al contenido'}
      </a>
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <Link href={href('home')} className="brand">
          <span className="brand-mark">
            <Landmark size={23} />
          </span>
          <span>
            Apo<span className="brand-light">Match</span>
            <small>{t.tagline}</small>
          </span>
        </Link>
        <button
          className="close-menu icon-button"
          onClick={() => setMenu(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <div className="nav-caption">
          {lang === 'en' ? 'YOUR CIVIC SPACE' : 'TU ESPACIO CÍVICO'}
        </div>
        <nav aria-label={lang === 'en' ? 'Main navigation' : 'Navegación principal'}>
          {nav.map(({ id, icon: Icon }) => (
            <Link
              key={id}
              href={href(id)}
              className={`nav-item ${route === id ? 'active' : ''}`}
              aria-current={route === id ? 'page' : undefined}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              <span>{t[id]}</span>
              {route === id && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-divider" />
        <Link className={`nav-item ${route === 'sources' ? 'active' : ''}`} href={href('sources')}>
          <FileCheck2 size={19} />
          {t.sources}
        </Link>
        {user?.memberships.some((m) => m.permissions.includes('admin.read')) && (
          <Link className={`nav-item ${route === 'admin' ? 'active' : ''}`} href={href('admin')}>
            <ShieldCheck size={19} />
            {t.admin}
          </Link>
        )}
        <div className="sidebar-bottom">
          <div className="trust-card">
            <ShieldCheck size={21} />
            <strong>{t.independent}</strong>
            <p>{t.neutral}</p>
          </div>
          <Link href={href('privacy')} className="sidebar-privacy">
            <CircleHelp size={15} />
            {t.privacy}
            <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-version">
            <span className="green-dot" />
            ApoMatch · v0.2
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <div className="location-label">
              <MapPin size={17} />
              <span>
                {city ? `${city.name}, ${city.county.state.abbreviation}` : t.chooseLocation}
              </span>
              <span className="zip-muted">{city?.zipCodes[0]?.zipCode}</span>
            </div>
            <span className="pilot-badge">{org === 'demo' ? 'DEMO' : t.pilot}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="language-button"
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              aria-label={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}
            >
              <Globe2 size={16} />
              {lang === 'en' ? 'ES' : 'EN'}
            </button>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={lang === 'en' ? 'Toggle dark mode' : 'Cambiar tema'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <Link href={href('account')} className="avatar" aria-label={t.account}>
                {user.name.slice(0, 1).toUpperCase()}
              </Link>
            ) : (
              <Link className="signin-link" href={href('login')}>
                {t.login}
                <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </header>
        {org === 'demo' && (
          <div className="demo-banner">
            <strong>{t.demo}.</strong> {t.demoHelp}
          </div>
        )}
        <main id="main-content" className="content" tabIndex={-1}>
          {error && (
            <div className="error-banner" role="alert">
              {t.error} <code>{error}</code>
              <Button variant="outline" onClick={reload}>
                {t.retry}
              </Button>
            </div>
          )}
          {loading ? (
            <div aria-busy="true" className="loading">
              <div className="skeleton hero-skeleton" />
              <div className="stats-grid">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton" />
                ))}
              </div>
              <span className="sr-only">{t.loading}</span>
            </div>
          ) : (
            <>
              {route === 'home' && (
                <>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-eyebrow">
                        <span className="green-dot" />
                        {t.welcome}
                      </span>
                      <h1>
                        {t.hero.split('\n').map((line, i) => (
                          <span key={i}>
                            {line}
                            <br />
                          </span>
                        ))}
                      </h1>
                      <p>{t.heroText}</p>
                      <div className="hero-actions">
                        <Button asChild>
                          <Link href={href('community')}>
                            {t.explore}
                            <ArrowRight size={17} />
                          </Link>
                        </Button>
                        <Link className="hero-link" href={href('elections')}>
                          {t.electoral}
                          <ArrowUpRight size={16} />
                        </Link>
                      </div>
                    </div>
                    <TownIllustration />
                  </section>
                  <section className="location-card">
                    <div>
                      <h2>{t.location}</h2>
                      <p>{t.locationText}</p>
                    </div>
                    <div>
                      {locationForm}
                      {searchResult && (
                        <div className="search-results">
                          {searchResult.length ? (
                            searchResult.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setCity(c);
                                  setSearchResult(null);
                                }}
                              >
                                {c.name}, {c.county.state.abbreviation}
                                <CheckCircle2 size={15} />
                              </button>
                            ))
                          ) : (
                            <p role="status">{t.noCity}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                  <div className="section-heading">
                    <div>
                      <h2>{t.local}</h2>
                      <p>{t.localText}</p>
                    </div>
                    <span className="small-muted">
                      {city?.county.name} {lang === 'en' ? 'County' : 'County'}
                    </span>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      icon={<Route />}
                      value={issues.total}
                      label={t.issues}
                      caption={
                        lang === 'en' ? 'Public, moderated reports' : 'Reportes públicos moderados'
                      }
                    />
                    <Stat
                      icon={<FileCheck2 />}
                      value={sourceTotal}
                      label={t.verified}
                      caption={
                        lang === 'en'
                          ? 'Traceable original sources'
                          : 'Fuentes originales trazables'
                      }
                    />
                    <Stat
                      icon={<BookOpen />}
                      value={elections.length}
                      label={t.upcoming}
                      caption={
                        lang === 'en'
                          ? 'Dates from official records'
                          : 'Fechas de registros oficiales'
                      }
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>{t.progress}</h2>
                        <Link href={href('community')}>
                          {t.viewAll}
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                      <p className="muted">{t.progressText}</p>
                      {issues.items.length ? (
                        issues.items
                          .slice(0, 3)
                          .map((i) => <IssueCard key={i.id} issue={i} lang={lang} compact />)
                      ) : (
                        <Empty title={t.emptyIssues}>{t.emptyText}</Empty>
                      )}
                    </section>
                    <section className="election-callout">
                      <span className="icon-tile">
                        <BookOpen size={22} />
                      </span>
                      <span className="eyebrow">CERORUIDO</span>
                      <h2>{t.electoral}</h2>
                      <p>{t.electionNote}</p>
                      {elections[0] && (
                        <div className="date-tile">
                          <CalendarDate value={elections[0].electionDate} lang={lang} />
                          <div>
                            <strong>{elections[0].name}</strong>
                            <span>{t.checked}</span>
                          </div>
                        </div>
                      )}
                      <Link href={href('elections')}>
                        {t.explore}
                        <ArrowRight size={16} />
                      </Link>
                    </section>
                  </div>
                  <section className="year-round">
                    <div className="icon-tile">
                      <Leaf size={23} />
                    </div>
                    <div>
                      <h3>{t.guidance}</h3>
                      <p>{t.guidanceText}</p>
                    </div>
                    <Link href={href('compare')}>
                      <ArrowRight size={21} />
                      <span className="sr-only">{t.compare}</span>
                    </Link>
                  </section>
                </>
              )}
              {route === 'community' && <Community org={org} city={city} user={user} lang={lang} />}
              {route === 'elections' && (
                <>
                  <Heading eyebrow="CERORUIDO" title={t.electoral} description={t.electionNote} />
                  <div className="two-column">
                    <section>
                      {elections.length ? (
                        elections.map((e) => (
                          <article className="panel election-card" key={e.id}>
                            <div className="election-title">
                              <CalendarDate value={e.electionDate} lang={lang} />
                              <div>
                                <span className="badge verified">
                                  <CheckCircle2 size={12} />
                                  {t.checked}
                                </span>
                                <h2>{e.name}</h2>
                                <p className="muted">{e.jurisdiction}</p>
                              </div>
                            </div>
                            <SourceLink source={e.source} lang={lang} />
                            {e.candidacies.length ? (
                              <div className="candidate-list">
                                {[...e.candidacies]
                                  .sort((a, b) => a.candidate.name.localeCompare(b.candidate.name))
                                  .map((c) => (
                                    <div key={c.id}>
                                      <h3>{c.candidate.name}</h3>
                                      <p>{c.office.title}</p>
                                      <p>{c.candidate.biography}</p>
                                      {c.candidate.statements.map((s, i) => (
                                        <SourceLink key={i} source={s.source} lang={lang} />
                                      ))}
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <Notice>{t.noCandidates}</Notice>
                            )}
                          </article>
                        ))
                      ) : (
                        <Empty title={t.pending} />
                      )}
                    </section>
                    <section className="panel">
                      <h2>{t.officialResources}</h2>
                      <OfficialLinks lang={lang} />
                      <Notice>{t.electionNote}</Notice>
                    </section>
                  </div>
                  <h2 className="subheading">{t.office}</h2>
                  <div className="cards-grid">
                    {offices.map((o) => (
                      <article className="panel" key={o.id}>
                        <Landmark className="accent" size={24} />
                        <h3>{o.title}</h3>
                        <p>{o.responsibilities}</p>
                        <SourceLink source={o.source} lang={lang} />
                      </article>
                    ))}
                  </div>
                </>
              )}
              {route === 'compare' && (
                <Comparison lang={lang} elections={elections} offices={offices} />
              )}
              {route === 'impact' && <Impact lang={lang} />}
              {route === 'groups' && (
                <>
                  <Heading eyebrow="VOTOENGRUPO" title={t.private} description={t.groupNote} />
                  {user ? (
                    <Groups org={org} city={city} user={user} lang={lang} />
                  ) : (
                    <Empty title={t.authRequired}>{authLink}</Empty>
                  )}
                </>
              )}
              {route === 'sources' && (
                <>
                  <Heading eyebrow="TRANSPARENCY" title={t.sources} description={t.sourceNote} />
                  <div className="stack">
                    {sources.length ? (
                      sources.map((s) => (
                        <article className="panel source-card" key={s.id}>
                          <div className="source-card-head">
                            <span className="icon-tile">
                              <FileCheck2 size={20} />
                            </span>
                            <span className="badge verified">{s.kind}</span>
                          </div>
                          <h2>{s.title}</h2>
                          <p>{s.excerpt}</p>
                          <SourceLink source={s} lang={lang} />
                        </article>
                      ))
                    ) : (
                      <Empty title={t.emptySources} />
                    )}
                  </div>
                  {sourceTotal > 20 && (
                    <div className="pagination">
                      <Button
                        variant="outline"
                        disabled={sourcePage === 1}
                        onClick={() => setSourcePage((v) => v - 1)}
                      >
                        {t.previous}
                      </Button>
                      <span>
                        {sourcePage} / {Math.ceil(sourceTotal / 20)}
                      </span>
                      <Button
                        variant="outline"
                        disabled={sourcePage * 20 >= sourceTotal}
                        onClick={() => setSourcePage((v) => v + 1)}
                      >
                        {t.next}
                      </Button>
                    </div>
                  )}
                  <Notice>{t.methodText}</Notice>
                </>
              )}
              {route === 'login' && (
                <Auth
                  lang={lang}
                  org={org}
                  onSuccess={() => {
                    window.location.href = href('account');
                  }}
                />
              )}
              {route === 'account' && (
                <>
                  <Heading eyebrow="APOMATCH" title={t.account} />
                  {user ? (
                    <Account
                      user={user}
                      org={org}
                      lang={lang}
                      onLogout={() => {
                        setUser(null);
                        window.location.href = href('home');
                      }}
                    />
                  ) : (
                    <Empty title={t.authRequired}>{authLink}</Empty>
                  )}
                </>
              )}
              {route === 'admin' && <AdminPanel org={org} lang={lang} user={user} />}
              {route === 'privacy' && (
                <>
                  <Heading eyebrow="APOMATCH" title={t.privacy} description={t.independent} />
                  <div className="panel prose">
                    <h2>{t.methodology}</h2>
                    <p>{t.methodText}</p>
                    <h2>{lang === 'en' ? 'Your data' : 'Tus datos'}</h2>
                    <p>{t.retention}</p>
                    <p>
                      {lang === 'en'
                        ? 'Sessions expire after 7 days. Rate-limit counters and expired invitations are removed by the operator cleanup command. Unread inbox messages are retained for 90 days. Audit records are retained for one year and pseudonymized when an account is deleted. Account deletion removes private owned groups and anonymizes authorship of public reports. Public report text is retained; do not include personal data.'
                        : 'Las sesiones vencen a los 7 días. Los límites de uso e invitaciones vencidas se limpian mediante una tarea del operador. Las notificaciones se conservan 90 días. La auditoría se conserva un año y se anonimiza al eliminar una cuenta. La eliminación borra los grupos privados propios y anonimiza la autoría de reportes públicos. El texto público se conserva: no incluyas datos personales.'}
                    </p>
                    <h2>{lang === 'en' ? 'Pilot scope' : 'Alcance del piloto'}</h2>
                    <p>{t.limits}</p>
                    <p>{t.electionNote}</p>
                    <h2>
                      {lang === 'en'
                        ? 'Accessibility and corrections'
                        : 'Accesibilidad y correcciones'}
                    </h2>
                    <p>
                      {lang === 'en'
                        ? 'Keyboard-accessible controls, light/dark themes and WCAG 2.2 AA are design goals. Formal certification and legal review are pending before public launch. Source corrections require fresh independent review. This installation does not send analytics or topic interests to third parties.'
                        : 'Los controles por teclado, temas claro y oscuro y WCAG 2.2 AA son objetivos de diseño. La certificación formal y revisión legal están pendientes antes del lanzamiento. Las correcciones de fuentes requieren una revisión independiente. Esta instalación no envía analíticas ni intereses a terceros.'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </main>
        <footer className="footer">
          <span>
            © 2026 ApoMatch <span className="footer-dot">·</span> {t.independent}
          </span>
          <div>
            <Link href={href('privacy')}>{t.privacy}</Link>
            <a href={`${route === 'home' ? '/' : `/${route}`}${org === 'demo' ? '' : '?org=demo'}`}>
              {org === 'demo' ? t.real : t.demo}
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
  caption,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  caption: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="icon-tile">{icon}</span>
        <span className="small-muted">APOMATCH</span>
      </div>
      <strong className="stat-value">{String(value).padStart(2, '0')}</strong>
      <h3>{label}</h3>
      <p>{caption}</p>
    </article>
  );
}
function CalendarDate({ value, lang }: { value: string; lang: Language }) {
  const d = new Date(value);
  return (
    <div className="calendar-date">
      <span>
        {d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-US', {
          month: 'short',
          timeZone: 'UTC',
        })}
      </span>
      <strong>{d.getUTCDate()}</strong>
      <small>{d.getUTCFullYear()}</small>
    </div>
  );
}
function TownIllustration() {
  return (
    <div className="town-art" aria-hidden="true">
      <div className="town-orbit orbit-one" />
      <div className="town-orbit orbit-two" />
      <div className="art-label label-top">
        <span className="green-dot" />
        Community, connected
      </div>
      <div className="town-sun" />
      <div className="town-ground" />
      <div className="building small-house left-house">
        <div className="roof" />
        <div className="window" />
        <div className="window second" />
        <div className="door" />
      </div>
      <div className="civic-building">
        <div className="civic-roof" />
        <div className="clock">
          <Landmark size={25} />
        </div>
        <div className="columns">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="steps" />
      </div>
      <div className="building right-house">
        <div className="roof" />
        <div className="window" />
        <div className="window second" />
        <div className="door" />
      </div>
      <div className="tree tree-left">
        <i />
        <span />
      </div>
      <div className="tree tree-right">
        <i />
        <span />
      </div>
      <div className="art-label label-bottom">
        <ShieldCheck size={15} />
        Facts first. Always.
      </div>
    </div>
  );
}
function IssueCard({
  issue,
  lang,
  compact = false,
}: {
  issue: IssueView;
  lang: Language;
  compact?: boolean;
}) {
  const t = messages[lang];
  const category = categories[lang][issue.category as keyof typeof categories.en] || issue.category;
  return (
    <article className={`issue-card ${compact ? 'compact' : ''}`}>
      <div className="issue-top">
        <span className="issue-category">
          <span className="category-dot" />
          {category}
        </span>
        <span className={`badge ${issue.status === 'RESOLVED' ? 'verified' : 'pending'}`}>
          <Clock3 size={12} />
          {statuses[lang][issue.status as keyof typeof statuses.en]}
        </span>
      </div>
      <h3>{issue.title}</h3>
      <p>{issue.description}</p>
      <div className="issue-location">
        <MapPin size={13} />
        {issue.approximateLocation}
        {issue.isDemo && <span className="badge">DEMO</span>}
      </div>
      {!compact && (
        <details>
          <summary>
            {t.details}
            <ChevronRight size={14} />
          </summary>
          <div className="timeline">
            {issue.updates.map((u) => (
              <div key={u.id}>
                <span className="timeline-dot" />
                <time>
                  {new Date(u.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-US')}
                </time>
                <strong>{statuses[lang][u.status as keyof typeof statuses.en]}</strong>
                <p>{u.note}</p>
                {u.source && <SourceLink source={u.source} lang={lang} />}
              </div>
            ))}
          </div>
          {issue.responsibleAuthority && (
            <p>
              {lang === 'en'
                ? 'Documented responsible authority: '
                : 'Autoridad responsable documentada: '}
              {issue.responsibleAuthority}
            </p>
          )}
        </details>
      )}
    </article>
  );
}
function Community({
  org,
  city,
  user,
  lang,
}: {
  org: string;
  city: CityView | null;
  user: UserView | null;
  lang: Language;
}) {
  const t = messages[lang];
  const [data, setData] = useState<{ items: IssueView[]; total: number; page: number }>({
      items: [],
      total: 0,
      page: 1,
    }),
    [q, setQ] = useState(''),
    [filter, setFilter] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!city) return;
    let active = true;
    setBusy(true);
    const timer = setTimeout(() => {
      api<typeof data>(
        `issues?city=${city.id}&q=${encodeURIComponent(q)}&category=${filter}&status=${status}&page=${page}`,
        org,
      )
        .then((d) => {
          if (active) {
            setData(d);
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [org, city, q, filter, status, page, refresh]);
  return (
    <>
      <Heading
        eyebrow="BARRIODECIDE"
        title={t.progress}
        description={t.reportNote}
        action={
          user ? (
            <Button onClick={() => setOpen(!open)}>
              <Plus size={17} />
              {open ? t.cancel : t.newIssue}
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/login${org === 'demo' ? '?org=demo' : ''}`}>{t.login}</Link>
            </Button>
          )
        }
      />
      {open && city && (
        <IssueForm
          city={city}
          org={org}
          lang={lang}
          onDone={() => {
            setOpen(false);
            setRefresh((v) => v + 1);
          }}
        />
      )}
      <div className="filter-bar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label={t.searchIssues}
            placeholder={t.searchIssues}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label={t.category}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">
            {t.all} · {t.category}
          </option>
          {Object.entries(categories[lang]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label={t.status}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">
            {t.all} · {t.status}
          </option>
          {Object.entries(statuses[lang]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {busy ? (
        <div className="skeleton" aria-label={t.loading} />
      ) : data.items.length ? (
        <div className="issue-grid">
          {data.items.map((i) => (
            <IssueCard key={i.id} issue={i} lang={lang} />
          ))}
        </div>
      ) : (
        <Empty title={t.emptyIssues}>{t.emptyText}</Empty>
      )}
      <div className="pagination">
        <span>
          {data.total} {t.issues.toLowerCase()}
        </span>
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
          {t.previous}
        </Button>
        <span>{page}</span>
        <Button
          variant="outline"
          disabled={page * 12 >= data.total}
          onClick={() => setPage((v) => v + 1)}
        >
          {t.next}
        </Button>
      </div>
      <Notice>{t.reportNote}</Notice>
    </>
  );
}
const issueClientSchema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(3000),
  approximateLocation: z.string().trim().min(3).max(180),
  category: z.enum([
    'STREETS',
    'LIGHTING',
    'WATER',
    'WASTE',
    'PARKS',
    'SAFETY',
    'SCHOOLS',
    'TRANSPORT',
    'OTHER',
  ]),
});
function IssueForm({
  city,
  org,
  lang,
  onDone,
}: {
  city: CityView;
  org: string;
  lang: Language;
  onDone: () => void;
}) {
  const t = messages[lang];
  const [result, setResult] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof issueClientSchema>>({
    resolver: zodResolver(issueClientSchema),
    defaultValues: { category: 'STREETS' },
  });
  return (
    <form
      className="panel form-stack report-form"
      onSubmit={handleSubmit(async (data) => {
        try {
          await api('issues', org, { ...data, cityId: city.id });
          setResult(t.submitted);
          onDone();
        } catch (e) {
          setResult((e as Error).message);
        }
      })}
    >
      <h2>{t.newIssue}</h2>
      <label>
        {t.title}
        <input {...register('title')} maxLength={140} />
        {errors.title && <span className="form-error">{errors.title.message}</span>}
      </label>
      <label>
        {t.description}
        <textarea {...register('description')} rows={4} maxLength={3000} />
        {errors.description && <span className="form-error">{errors.description.message}</span>}
      </label>
      <div className="form-two">
        <label>
          {t.category}
          <select {...register('category')}>
            {Object.entries(categories[lang]).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.approximate}
          <input {...register('approximateLocation')} maxLength={180} />
          {errors.approximateLocation && (
            <span className="form-error">{errors.approximateLocation.message}</span>
          )}
        </label>
      </div>
      <p className="muted">
        {lang === 'en'
          ? 'Use a public landmark or intersection. Do not include home addresses, names, faces or personal information.'
          : 'Usa un lugar público o intersección. No incluyas domicilios, nombres, rostros ni datos personales.'}
      </p>
      <div role="status">{result}</div>
      <Button disabled={isSubmitting}>{t.save}</Button>
    </form>
  );
}
function OfficialLinks({ lang }: { lang: Language }) {
  const links =
    lang === 'en'
      ? [
          ['Nebraska elections', 'https://sos.nebraska.gov/elections'],
          ['County election office', 'https://nemahacountyne.gov/election-office/'],
          ['Registration & polling lookup', 'https://sos.nebraska.gov/elections-division'],
          [
            'Voter requirements & early voting',
            'https://sos.nebraska.gov/elections/general-voter-information',
          ],
        ]
      : [
          ['Elecciones en Nebraska', 'https://sos.nebraska.gov/elections'],
          ['Oficina electoral del condado', 'https://nemahacountyne.gov/election-office/'],
          ['Registro y consulta de votación', 'https://sos.nebraska.gov/elections-division'],
          [
            'Requisitos y voto anticipado',
            'https://sos.nebraska.gov/elections/general-voter-information',
          ],
        ];
  return (
    <div className="official-links">
      {links.map(([name, url]) => (
        <a href={url} key={url} rel="noopener noreferrer" target="_blank">
          {name}
          <ExternalLink size={15} />
        </a>
      ))}
    </div>
  );
}
function Comparison({
  lang,
  elections,
  offices,
}: {
  lang: Language;
  elections: ElectionView[];
  offices: OfficeView[];
}) {
  const t = messages[lang];
  const [topics, setTopics] = useState<string[]>([]),
    [officeId, setOfficeId] = useState('');
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('apomatch-topics') || '[]');
      if (Array.isArray(raw))
        setTopics(raw.filter((v) => typeof v === 'string' && topicKeys.includes(v)));
    } catch {
      /* Invalid local settings are ignored. */
    }
  }, []);
  function change(next: string[]) {
    setTopics(next);
    if (next.length) localStorage.setItem('apomatch-topics', JSON.stringify(next));
    else localStorage.removeItem('apomatch-topics');
  }
  const candidates = elections
    .flatMap((e) => e.candidacies.map((c) => ({ ...c, electionId: e.id, electionName: e.name })))
    .filter((c) => !officeId || c.office.id === officeId)
    .sort((a, b) => a.candidate.name.localeCompare(b.candidate.name));
  return (
    <>
      <Heading eyebrow="APOMATCH" title={t.comparison} description={t.comparisonText} />
      <section className="panel">
        <div className="section-heading">
          <h2>{t.localTopics}</h2>
          <Button variant="ghost" onClick={() => change([])}>
            {t.clear}
          </Button>
        </div>
        <div className="topic-chips">
          {topicKeys.map((key, i) => (
            <button
              className={`topic-chip ${topics.includes(key) ? 'selected' : ''}`}
              key={key}
              aria-pressed={topics.includes(key)}
              onClick={() =>
                change(topics.includes(key) ? topics.filter((x) => x !== key) : [...topics, key])
              }
            >
              {topicLabels[lang][i]}
              {topics.includes(key) && <CheckCircle2 size={14} />}
            </button>
          ))}
        </div>
        <p className="muted">{t.topicNote}</p>
      </section>
      <div className="filter-bar">
        <label>
          {t.office}
          <select value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">{t.all}</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!candidates.length ? (
        <Empty title={t.noCandidates}>{t.noProposals}</Empty>
      ) : (
        <div className="comparison-scroll">
          <table className="comparison-table">
            <caption>{t.comparisonText}</caption>
            <thead>
              <tr>
                <th scope="col">{t.category}</th>
                {candidates.map((c) => (
                  <th key={c.id} scope="col">
                    <h3>{c.candidate.name}</h3>
                    <p>
                      {c.office.title} · {c.electionName}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(topics.length ? topics : topicKeys).map((topic) => (
                <tr key={topic}>
                  <th scope="row">{topicLabels[lang][topicKeys.indexOf(topic)]}</th>
                  {candidates.map((c) => (
                    <td key={c.id}>
                      {c.proposals.filter((p) => p.topic === topic).length ? (
                        c.proposals
                          .filter((p) => p.topic === topic)
                          .map((p) => (
                            <div key={p.id}>
                              <p>{p.text}</p>
                              <SourceLink source={p.source} lang={lang} />
                            </div>
                          ))
                      ) : (
                        <span className="muted">{t.noProposals}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Notice>{t.neutral}</Notice>
    </>
  );
}
function Impact({ lang }: { lang: Language }) {
  const t = messages[lang];
  const [value, setValue] = useState('200000'),
    [current, setCurrent] = useState('1'),
    [proposed, setProposed] = useState('1.1');
  let result: ReturnType<typeof propertyTax> | null = null;
  try {
    if (value !== '' && current !== '' && proposed !== '')
      result = propertyTax({
        assessedValue: Number(value),
        currentRate: Number(current),
        proposedRate: Number(proposed),
      });
  } catch {
    /* Show validation state, never fabricate a number. */
  }
  const money = (n: number) =>
    n.toLocaleString(lang === 'en' ? 'en-US' : 'es-US', { style: 'currency', currency: 'USD' });
  return (
    <>
      <Heading eyebrow="IMPACTOREAL" title={t.calculator} description={t.calcText} />
      <div className="calculator-grid">
        <section className="panel form-stack">
          <span className="badge pending">
            {lang === 'en' ? 'HYPOTHETICAL SCENARIO' : 'ESCENARIO HIPOTÉTICO'}
          </span>
          <label>
            {t.assessed}
            <input
              type="number"
              min="0"
              max="1000000000"
              step="1000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            {t.current}
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label>
            {t.proposed}
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
            />
          </label>
          <details>
            <summary>{lang === 'en' ? 'Formula & model version' : 'Fórmula y versión'}</summary>
            <p>
              Annual tax = taxable value × (rate / 100). Difference = scenario annual − current
              annual. USD rounded to cents. Model v1.
            </p>
            <p>
              {lang === 'en'
                ? 'General arithmetic illustration. No official tax dataset is used.'
                : 'Ilustración aritmética. No utiliza datos tributarios oficiales.'}
            </p>
          </details>
        </section>
        <section className="calculation-results" aria-live="polite">
          {result ? (
            <>
              <span className="eyebrow">{lang === 'en' ? 'YOUR SCENARIO' : 'TU ESCENARIO'}</span>
              <div>
                <span>{t.annual}</span>
                <strong>{money(result.currentAnnual)}</strong>
              </div>
              <div>
                <span>{t.newAnnual}</span>
                <strong>{money(result.proposedAnnual)}</strong>
              </div>
              <div className="delta">
                <span>{t.difference}</span>
                <strong>
                  {result.annualDifference > 0 ? '+' : ''}
                  {money(result.annualDifference)}
                </strong>
              </div>
              <p>{lang === 'en' ? 'Estimate · USD / year' : 'Estimación · USD / año'}</p>
            </>
          ) : (
            <p role="alert">
              {lang === 'en'
                ? 'Enter valid nonnegative values. Rates must be between 0 and 100%.'
                : 'Introduce valores no negativos. Las tasas deben estar entre 0 y 100 %.'}
            </p>
          )}
        </section>
      </div>
      <Notice>{t.assumptions}</Notice>
    </>
  );
}
const clientAuthSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  name: z.string().max(80).optional(),
});
function Auth({ lang, org, onSuccess }: { lang: Language; org: string; onSuccess: () => void }) {
  const t = messages[lang];
  const [signup, setSignup] = useState(false),
    [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof clientAuthSchema>>({ resolver: zodResolver(clientAuthSchema) });
  return (
    <section className="auth-panel panel">
      <div className="icon-tile">
        <ShieldCheck size={24} />
      </div>
      <h1>{signup ? t.register : t.login}</h1>
      <p>{t.independent}</p>
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (data) => {
          setError('');
          try {
            await api(signup ? 'auth/register' : 'auth/login', org, data);
            onSuccess();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        {signup && (
          <label>
            {t.name}
            <input {...register('name')} required autoComplete="nickname" maxLength={80} />
          </label>
        )}
        <label>
          {t.email}
          <input {...register('email')} type="email" autoComplete="email" />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </label>
        <label>
          {t.password}
          <input
            {...register('password')}
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
          />
          <span className="muted">{t.passwordHint}</span>
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={isSubmitting}>
          {signup ? t.register : t.login}
          <ArrowRight size={16} />
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setSignup(!signup)}>
        {signup ? t.login : t.register}
      </Button>
    </section>
  );
}
function Groups({
  org,
  city,
  user,
  lang,
}: {
  org: string;
  city: CityView | null;
  user: UserView;
  lang: Language;
}) {
  const t = messages[lang];
  const [groups, setGroups] = useState<GroupView[]>([]),
    [name, setName] = useState(''),
    [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [invite, setInvite] = useState('');
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const inv = hash.get('invite');
    if (inv) {
      setToken(inv);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<{ items: GroupView[] }>('groups', org)
      .then((d) => {
        if (active) setGroups(d.items);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [org, refresh]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setRefresh((v) => v + 1);
      setMessage(t.success);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="two-column">
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api('groups', org, { name, cityId: city?.id });
              setName('');
            });
          }}
        >
          <h2>{t.createGroup}</h2>
          <label>
            {t.name}
            <input
              value={name}
              required
              minLength={2}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button disabled={busy || !city}>
            {t.create}
            <Plus size={16} />
          </Button>
        </form>
        <form
          className="panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api('groups/join', org, { token });
              setToken('');
            });
          }}
        >
          <h2>{t.join}</h2>
          <label>
            {lang === 'en' ? 'Invitation token' : 'Código de invitación'}
            <input
              value={token}
              required
              minLength={30}
              maxLength={128}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Button variant="outline" disabled={busy}>
            {t.join}
            <ArrowRight size={16} />
          </Button>
        </form>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {invite && (
        <div className="panel">
          <label>
            {t.invite}
            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
          </label>
          <p className="muted">
            {lang === 'en'
              ? 'Single use · expires in 48 hours. Share only with the intended participant.'
              : 'Un solo uso · vence en 48 horas. Compártelo solo con el participante previsto.'}
          </p>
        </div>
      )}
      <div className="stack">
        {groups.length ? (
          groups.map((g) => (
            <article className="panel group-card" key={g.id}>
              <div className="section-heading">
                <div>
                  <h2>
                    <Users size={20} />
                    {g.name}
                  </h2>
                  <p className="muted">
                    {g._count.memberships}{' '}
                    {lang === 'en' ? 'consenting members' : 'miembros voluntarios'}
                  </p>
                </div>
                {g.ownerId === user.id && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const r = await api<{ url: string }>(`groups/${g.id}/invite`, org, {});
                        setInvite(r.url);
                      })
                    }
                  >
                    {t.invite}
                  </Button>
                )}
              </div>
              {g.events.map((ev) => (
                <div className="event-card" key={ev.id}>
                  <Clock3 size={18} />
                  <div>
                    <h3>{ev.title}</h3>
                    <time>
                      {new Date(ev.startsAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-US')}
                    </time>
                    <p>{ev.description}</p>
                    {ev.officialResourceUrl && (
                      <a href={ev.officialResourceUrl} target="_blank" rel="noopener noreferrer">
                        {t.source}
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {g.ownerId === user.id && (
                <details>
                  <summary>
                    {t.event}
                    <Plus size={16} />
                  </summary>
                  <EventForm
                    org={org}
                    groupId={g.id}
                    lang={lang}
                    onDone={() => setRefresh((v) => v + 1)}
                  />
                </details>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      lang === 'en'
                        ? 'Delete owned group or leave this group?'
                        : '¿Eliminar el grupo propio o salir de este grupo?',
                    )
                  )
                    void act(() => api(`groups/${g.id}`, org, undefined, 'DELETE'));
                }}
              >
                {lang === 'en' ? 'Delete / leave group' : 'Eliminar / salir del grupo'}
              </Button>
            </article>
          ))
        ) : (
          <Empty title={t.noGroups} />
        )}
      </div>
      <Notice>{t.groupNote}</Notice>
    </>
  );
}
function EventForm({
  org,
  groupId,
  lang,
  onDone,
}: {
  org: string;
  groupId: string;
  lang: Language;
  onDone: () => void;
}) {
  const t = messages[lang];
  const [msg, setMsg] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack event-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
          await api(`groups/${groupId}/events`, org, {
            title: data.get('title'),
            description: data.get('description'),
            startsAt: new Date(String(data.get('startsAt'))).toISOString(),
            ...(data.get('url') ? { officialResourceUrl: data.get('url') } : {}),
          });
          setMsg(t.success);
          form.reset();
          onDone();
        } catch (e) {
          setMsg((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {t.title}
        <input name="title" required maxLength={140} />
      </label>
      <label>
        {t.description}
        <textarea name="description" required maxLength={2000} />
      </label>
      <label>
        {t.date}
        <input name="startsAt" type="datetime-local" required />
      </label>
      <label>
        {t.source} (HTTPS, {lang === 'en' ? 'optional' : 'opcional'})<input name="url" type="url" />
      </label>
      <p role="status">{msg}</p>
      <Button disabled={busy}>{t.save}</Button>
    </form>
  );
}
function Account({
  user,
  org,
  lang,
  onLogout,
}: {
  user: UserView;
  org: string;
  lang: Language;
  onLogout: () => void;
}) {
  const t = messages[lang];
  const [notifications, setNotifications] = useState<
      { id: string; title: string; readAt: string | null; createdAt: string }[]
    >([]),
    [error, setError] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api<{ items: typeof notifications }>('notifications', org)
        .then((d) => setNotifications(d.items))
        .catch((e) => setError(e.message)),
    [org],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="two-column">
      <section className="panel form-stack">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        {user.memberships.map((m) => (
          <span key={m.organizationId} className="badge">
            {m.roleId}
          </span>
        ))}
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await api('auth/logout', org, {});
              onLogout();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {t.signOut}
        </Button>
        <a className="btn btn-outline" href="/api/account/export" download="apomatch-account.json">
          {t.export}
          <ArrowUpRight size={16} />
        </a>
        <details>
          <summary>{t.deleteAccount}</summary>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                !window.confirm(
                  lang === 'en'
                    ? 'Permanently delete your account and owned private groups?'
                    : '¿Eliminar definitivamente tu cuenta y grupos privados propios?',
                )
              )
                return;
              setBusy(true);
              try {
                await api('account', org, { password }, 'DELETE');
                localStorage.removeItem('apomatch-topics');
                onLogout();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t.password}
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <Button variant="destructive" disabled={busy}>
              {t.deleteAccount}
            </Button>
          </form>
        </details>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>
            <Bell size={19} />
            {t.inbox}
          </h2>
          <Button
            variant="ghost"
            onClick={async () => {
              await api('notifications/read', org, {});
              await load();
            }}
          >
            <CheckCircle2 size={16} />
            {t.clear}
          </Button>
        </div>
        {notifications.length ? (
          notifications.map((n) => (
            <div className={`notification ${n.readAt ? 'read' : ''}`} key={n.id}>
              <p>{n.title}</p>
              <time>{new Date(n.createdAt).toLocaleString()}</time>
            </div>
          ))
        ) : (
          <Empty title={t.noAlerts} />
        )}
      </section>
    </div>
  );
}
