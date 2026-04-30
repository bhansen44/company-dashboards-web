import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const AUTH0_DOMAIN = "dev-r42hmecl0vnw6rr3.us.auth0.com";
const AUTH0_CLIENT_ID = "L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF";

function makeNavigation(section = "overview", overrides = {}) {
  return {
    section,
    departmentId: null,
    subdepartmentId: null,
    employeeDepartmentId: null,
    projectTypeLabel: null,
    projectId: null,
    ...overrides,
  };
}

export default function App() {
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        scope: "openid profile email",
      }}
    >
      <Dashboard />
    </Auth0Provider>
  );
}

function Dashboard() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading,
    getIdTokenClaims,
  } = useAuth0();

  const [dashboardData, setDashboardData] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [openingArtifactId, setOpeningArtifactId] = useState(null);
  const [navigation, setNavigation] = useState(makeNavigation("overview"));
  const [historyStack, setHistoryStack] = useState([]);
  const [searchText, setSearchText] = useState("");

  const navigateTo = useCallback(
    (nextNavigation) => {
      setHistoryStack((currentHistory) => [...currentHistory, navigation]);
      setNavigation(nextNavigation);
    },
    [navigation]
  );

  const goBack = useCallback(() => {
    setHistoryStack((currentHistory) => {
      const previousNavigation = currentHistory[currentHistory.length - 1];

      if (previousNavigation) {
        setNavigation(previousNavigation);
      }

      return currentHistory.slice(0, -1);
    });
  }, []);

  const goHome = useCallback(() => {
    setHistoryStack([]);
    setNavigation(makeNavigation("overview"));
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setApiLoading(true);
    setApiError(null);

    try {
      const claims = await getIdTokenClaims({
  cacheMode: "off",
});
      const token = claims?.__raw;

      if (!token) {
        throw new Error("Could not read Auth0 ID token.");
      }

      const response = await fetch("/api/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Dashboard API request failed.");
      }

      setDashboardData(data);
    } catch (error) {
      setApiError(error.message);
    } finally {
      setApiLoading(false);
    }
  }, [getIdTokenClaims, isAuthenticated]);

  const openVersionedArtifact = useCallback(
    async (artifact, stage = "published") => {
      if (!artifact?.artifact_id) {
        return;
      }

      const artifactWindow = window.open("", "_blank");

      if (artifactWindow) {
        artifactWindow.document.write(
          "<p style='font-family:Arial;padding:24px'>Loading HRI artifact...</p>"
        );
      }

      setOpeningArtifactId(`${artifact.artifact_id}:${stage}`);

      try {
        const claims = await getIdTokenClaims({
  cacheMode: "off",
});
        const token = claims?.__raw;

        if (!token) {
          throw new Error("Could not read Auth0 ID token.");
        }

        const response = await fetch(
          `/api/artifact-html?artifactId=${encodeURIComponent(
            artifact.artifact_id
          )}&stage=${encodeURIComponent(stage)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const contentType = response.headers.get("content-type") || "";
        const body = await response.text();

        if (!response.ok) {
          let message = body;

          if (contentType.includes("application/json")) {
            try {
              message = JSON.parse(body).error || body;
            } catch {
              message = body;
            }
          }

          throw new Error(message);
        }

        if (!artifactWindow) {
          throw new Error("Popup was blocked. Allow popups for this site.");
        }

        artifactWindow.document.open();
        artifactWindow.document.write(body);
        artifactWindow.document.close();
      } catch (error) {
        if (artifactWindow) {
          artifactWindow.document.open();
          artifactWindow.document.write(
            `<pre style="font-family:Arial;padding:24px;white-space:pre-wrap;color:#7a0000">Artifact failed to open:\n\n${escapeHtml(
              error.message
            )}</pre>`
          );
          artifactWindow.document.close();
        } else {
          alert(error.message);
        }
      } finally {
        setOpeningArtifactId(null);
      }
    },
    [getIdTokenClaims]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const normalizedSearch = searchText.trim().toLowerCase();

  const departmentMap = useMemo(() => {
    const map = new Map();

    (dashboardData?.departments || []).forEach((department) => {
      const id = department.department_id || department.id;
      const name = department.department_name || department.name || id;

      if (id) {
        map.set(id, name);
      }
    });

    return map;
  }, [dashboardData]);

const artifacts = useMemo(
  () => dashboardData?.artifacts ?? [],
  [dashboardData]
);

const employeeCards = useMemo(
  () => dashboardData?.employeeCards ?? [],
  [dashboardData]
);

const projects = useMemo(
  () => dashboardData?.projects ?? [],
  [dashboardData]
);

  const artifactsByDepartment = useMemo(() => {
    const grouped = {};

    artifacts.forEach((artifact) => {
      const departmentId = artifact.department_id || "other";

      if (!grouped[departmentId]) {
        grouped[departmentId] = [];
      }

      grouped[departmentId].push(artifact);
    });

    return grouped;
  }, [artifacts]);

  const projectTileCount = useMemo(() => {
    if (dashboardData?.counts?.projectTiles !== undefined) {
      return dashboardData.counts.projectTiles;
    }

    return projects.reduce(
      (total, project) => total + (project.project_tiles || []).length,
      0
    );
  }, [dashboardData, projects]);

  const currentUser = dashboardData?.user;

  if (isLoading) {
    return <FullPageLoading message="Loading HRI dashboard..." />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => loginWithRedirect()} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">HRI</div>

          <div>
            <div className="eyebrow">Secure Employee Portal</div>
            <h1>Executive Dashboard</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="user-pill">
            <span className="user-avatar">
              {getInitials(currentUser?.name || user?.name || user?.email)}
            </span>

            <span className="user-pill-text">
              <strong>{currentUser?.name || user?.name || user?.email}</strong>
              <small>{currentUser?.access_level || "Loading access..."}</small>
            </span>
          </div>

          <button
            className="button ghost"
            onClick={loadDashboardData}
            disabled={apiLoading}
          >
            {apiLoading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="button dark"
            onClick={() =>
              logout({
                logoutParams: {
                  returnTo: window.location.origin,
                },
              })
            }
          >
            Logout
          </button>
        </div>
      </header>

      <main className="page">
        {apiError && (
          <section className="alert-card">
            <h2>Permission or API issue</h2>
            <p>{apiError}</p>
            <p className="muted">
              Check Supabase invite status, Vercel environment variables, and
              the signed-in email.
            </p>
          </section>
        )}

        {!dashboardData && !apiError && (
          <section className="panel">
            <FullPageLoading
              message="Loading permissions from Supabase..."
              compact
            />
          </section>
        )}

        {dashboardData && (
          <>
            <HeroSection
              dashboardData={dashboardData}
              projectTileCount={projectTileCount}
            />

            <nav className="tabbar" aria-label="Dashboard sections">
              <button
                className={navigation.section === "overview" ? "active" : ""}
                onClick={() => navigateTo(makeNavigation("overview"))}
              >
                Overview
              </button>

              <button
                className={navigation.section === "dashboards" ? "active" : ""}
                onClick={() => navigateTo(makeNavigation("dashboards"))}
              >
                Dashboard Tiles
              </button>

              <button
                className={navigation.section === "employees" ? "active" : ""}
                onClick={() => navigateTo(makeNavigation("employees"))}
              >
                Employee Cards
              </button>

              <button
                className={navigation.section === "projects" ? "active" : ""}
                onClick={() => navigateTo(makeNavigation("projects"))}
              >
                Project Insights
              </button>
            </nav>

            <NavigationControls
              canGoBack={historyStack.length > 0}
              onBack={goBack}
              onHome={goHome}
              label={getNavigationLabel(navigation, departmentMap, projects)}
            />

            <section className="toolbar">
              <div>
                <label htmlFor="dashboard-search">Search</label>
                <input
                  id="dashboard-search"
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search dashboards, employees, or projects..."
                />
              </div>
            </section>

            {navigation.section === "overview" && (
              <OverviewTab
                dashboardData={dashboardData}
                artifactsByDepartment={artifactsByDepartment}
                departmentMap={departmentMap}
                onOpenDepartment={(departmentId) =>
                  navigateTo(makeNavigation("dashboards", { departmentId }))
                }
                onOpenDashboardRoot={() =>
                  navigateTo(makeNavigation("dashboards"))
                }
                onOpenEmployeeRoot={() => navigateTo(makeNavigation("employees"))}
                onOpenProjectRoot={() => navigateTo(makeNavigation("projects"))}
              />
            )}

            {navigation.section === "dashboards" && (
              <DashboardsTab
                artifacts={artifacts}
                navigation={navigation}
                departmentMap={departmentMap}
                searchText={normalizedSearch}
                onOpenDepartment={(departmentId) =>
                  navigateTo(makeNavigation("dashboards", { departmentId }))
                }
                onOpenSubdepartment={(departmentId, subdepartmentId) =>
                  navigateTo(
                    makeNavigation("dashboards", {
                      departmentId,
                      subdepartmentId,
                    })
                  )
                }
                onOpenArtifact={openVersionedArtifact}
                openingArtifactId={openingArtifactId}
              />
            )}

            {navigation.section === "employees" && (
              <EmployeesTab
                employeeCards={employeeCards}
                navigation={navigation}
                departmentMap={departmentMap}
                searchText={normalizedSearch}
                onOpenDepartment={(employeeDepartmentId) =>
                  navigateTo(
                    makeNavigation("employees", { employeeDepartmentId })
                  )
                }
              />
            )}

            {navigation.section === "projects" && (
              <ProjectsTab
                projects={projects}
                navigation={navigation}
                searchText={normalizedSearch}
                onOpenProjectType={(projectTypeLabel) =>
                  navigateTo(
                    makeNavigation("projects", { projectTypeLabel })
                  )
                }
                onOpenProject={(projectTypeLabel, projectId) =>
                  navigateTo(
                    makeNavigation("projects", {
                      projectTypeLabel,
                      projectId,
                    })
                  )
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LoginPage({ onLogin }) {
  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">HRI</div>

        <h1>Company Intelligence Portal</h1>

        <p>
          Role-based access to executive dashboards, employee cards, project
          insights, and generated business artifacts.
        </p>

        <div className="login-points">
          <span>Secure Auth0 sign-in</span>
          <span>Supabase permission engine</span>
          <span>Stable artifact links</span>
        </div>
      </div>

      <div className="login-card">
        <div className="eyebrow">Welcome</div>

        <h2>Sign in to continue</h2>

        <p>
          Access is controlled by your HRI invite status, access level,
          employee-card permissions, and project rules.
        </p>

        <button className="button primary full" onClick={onLogin}>
          Sign In with Company Account
        </button>
      </div>
    </div>
  );
}

function HeroSection({ dashboardData, projectTileCount }) {
  const user = dashboardData.user;

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">Current Access</div>

        <h2>
          {getGreeting()}, {firstName(user?.name)}.
        </h2>

        <p>
          You are signed in with <strong>{user?.access_level}</strong> access.
          The cards below are filtered through Supabase based on your current HRI
          permissions.
        </p>
      </div>

      <div className="stat-grid">
        <StatCard label="Dashboard Tiles" value={dashboardData.counts.artifacts} />
        <StatCard label="Employee Cards" value={dashboardData.counts.employeeCards} />
        <StatCard label="Project Insights" value={dashboardData.counts.projects} />
        <StatCard label="Project Tile Placeholders" value={projectTileCount || 0} />
      </div>
    </section>
  );
}

function NavigationControls({ canGoBack, onBack, onHome, label }) {
  return (
    <section className="navigation-row">
      <div className="breadcrumb">
        <span className="eyebrow">Current View</span>
        <strong>{label}</strong>
      </div>

      <div className="navigation-actions">
        <button className="button ghost" onClick={onHome}>
          Home
        </button>

        <button className="button ghost" onClick={onBack} disabled={!canGoBack}>
          ← Back
        </button>
      </div>
    </section>
  );
}

function OverviewTab({
  dashboardData,
  artifactsByDepartment,
  departmentMap,
  onOpenDepartment,
  onOpenDashboardRoot,
  onOpenEmployeeRoot,
  onOpenProjectRoot,
}) {
  const departments = Object.entries(artifactsByDepartment).map(
    ([departmentId, artifacts]) => ({
      id: departmentId,
      name: getDepartmentName(departmentId, departmentMap),
      artifacts,
    })
  );

  departments.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="overview-grid">
      <section className="panel wide">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Department Portfolio</div>
            <h2>Accessible dashboard groups</h2>
          </div>

          <button className="button ghost" onClick={onOpenDashboardRoot}>
            View dashboard departments
          </button>
        </div>

        <div className="department-grid">
          {departments.map((department) => (
            <DepartmentCard
              key={department.id}
              title={department.name}
              subtitle={`${department.artifacts.length} dashboard tile${
                department.artifacts.length === 1 ? "" : "s"
              }`}
              icon={departmentIcon(department.id)}
              onClick={() => onOpenDepartment(department.id)}
            />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Visible Projects</div>
            <h2>Project access</h2>
          </div>

          <button className="button ghost" onClick={onOpenProjectRoot}>
            Open
          </button>
        </div>

        <div className="mini-list">
          {summarizeBy(dashboardData.projects || [], "project_type_label").map(
            (item) => (
              <div key={item.name} className="mini-row">
                <span>{item.name || "Unassigned"}</span>
                <strong>{item.count}</strong>
              </div>
            )
          )}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Employee Cards</div>
            <h2>Card visibility</h2>
          </div>

          <button className="button ghost" onClick={onOpenEmployeeRoot}>
            Open
          </button>
        </div>

        <div className="mini-list">
          {summarizeBy(dashboardData.employeeCards || [], "department_id")
            .slice(0, 8)
            .map((item) => (
              <div key={item.name} className="mini-row">
                <span>{getDepartmentName(item.name, departmentMap)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}

function DashboardsTab({
  artifacts,
  navigation,
  departmentMap,
  searchText,
  onOpenDepartment,
  onOpenSubdepartment,
  onOpenArtifact,
  openingArtifactId,
}) {
  const visibleArtifacts = filterArtifacts(artifacts, searchText);

  if (!navigation.departmentId) {
    const departmentGroups = groupArtifactsByDepartment(
      visibleArtifacts,
      departmentMap
    );

    if (!departmentGroups.length) {
      return <EmptyState title="No dashboard departments match your search." />;
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Dashboard Tiles</div>
            <h2>Select a department</h2>
          </div>
        </div>

        <div className="department-grid">
          {departmentGroups.map((department) => (
            <DepartmentCard
              key={department.id}
              title={department.name}
              subtitle={`${department.artifacts.length} dashboard tile${
                department.artifacts.length === 1 ? "" : "s"
              }`}
              icon={departmentIcon(department.id)}
              onClick={() => onOpenDepartment(department.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  const departmentArtifacts = visibleArtifacts.filter(
    (artifact) => artifact.department_id === navigation.departmentId
  );

  const subdepartmentGroups = groupArtifactsBySubdepartment(
    departmentArtifacts,
    navigation.departmentId,
    departmentMap
  );

  const hasSubdepartments = subdepartmentGroups.some((group) => !group.isDirect);

  if (hasSubdepartments && !navigation.subdepartmentId) {
    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Subdepartments</div>
            <h2>{getDepartmentName(navigation.departmentId, departmentMap)}</h2>
          </div>
        </div>

        <div className="department-grid">
          {subdepartmentGroups.map((group) => (
            <DepartmentCard
              key={group.id}
              title={group.name}
              subtitle={`${group.artifacts.length} dashboard tile${
                group.artifacts.length === 1 ? "" : "s"
              }`}
              icon={departmentIcon(group.id)}
              onClick={() =>
                onOpenSubdepartment(navigation.departmentId, group.id)
              }
            />
          ))}
        </div>
      </section>
    );
  }

  const tileArtifacts = hasSubdepartments
    ? departmentArtifacts.filter((artifact) => {
        if (navigation.subdepartmentId === "__direct") {
          return !artifact.subdepartment_id;
        }

        return artifact.subdepartment_id === navigation.subdepartmentId;
      })
    : departmentArtifacts;

  const heading = hasSubdepartments
    ? getDepartmentName(navigation.subdepartmentId, departmentMap)
    : getDepartmentName(navigation.departmentId, departmentMap);

  if (!tileArtifacts.length) {
    return <EmptyState title="No dashboard tiles match your filters." />;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Artifact Tiles</div>
          <h2>{heading}</h2>
        </div>
      </div>

      <div className="card-grid">
        {tileArtifacts.map((artifact) => (
          <DashboardArtifactCard
            key={artifact.artifact_id}
            artifact={artifact}
            departmentMap={departmentMap}
            onOpenArtifact={onOpenArtifact}
            openingArtifactId={openingArtifactId}
          />
        ))}
      </div>
    </section>
  );
}

function DashboardArtifactCard({
  artifact,
  departmentMap,
  onOpenArtifact,
  openingArtifactId,
}) {
  const hasPublishedVersion = Boolean(artifact.current_published_version_id);
  const hasPreviewVersion = Boolean(artifact.current_preview_version_id);
  const hasExternalUrl = Boolean(artifact.artifact_url);

  return (
    <article className="dashboard-card">
      <div className="card-top">
        <div className="card-icon">{departmentIcon(artifact.department_id)}</div>

        <span
          className={
            hasPublishedVersion || hasExternalUrl ? "status active" : "status pending"
          }
        >
          {hasPublishedVersion || hasExternalUrl
            ? artifact.status || "Active"
            : "Coming Soon"}
        </span>
      </div>

      <h3>{artifact.tile_title || artifact.artifact_id}</h3>
      <p>{artifact.source_name || "Dashboard artifact"}</p>

      <div className="meta-stack">
        <span>
          Department: {getDepartmentName(artifact.department_id, departmentMap)}
        </span>

        {artifact.subdepartment_id && (
          <span>
            Subdepartment:{" "}
            {getDepartmentName(artifact.subdepartment_id, departmentMap)}
          </span>
        )}

        <span>Type: {formatText(artifact.artifact_type)}</span>
        <span>ID: {artifact.artifact_id}</span>
      </div>

      <div className="card-actions">
        {hasPublishedVersion ? (
          <>
            <button
              className="button primary"
              onClick={() => onOpenArtifact(artifact, "published")}
              disabled={
                openingArtifactId === `${artifact.artifact_id}:published`
              }
            >
              {openingArtifactId === `${artifact.artifact_id}:published`
                ? "Opening..."
                : "Open Dashboard"}
            </button>

            {hasPreviewVersion && (
              <button
                className="button ghost"
                onClick={() => onOpenArtifact(artifact, "preview")}
                disabled={
                  openingArtifactId === `${artifact.artifact_id}:preview`
                }
              >
                {openingArtifactId === `${artifact.artifact_id}:preview`
                  ? "Opening..."
                  : "Preview"}
              </button>
            )}
          </>
        ) : hasExternalUrl ? (
          <a
            className="button primary"
            href={artifact.artifact_url}
            target="_blank"
            rel="noreferrer"
          >
            Open Dashboard
          </a>
        ) : (
          <button className="button disabled" disabled>
            Coming Soon
          </button>
        )}
      </div>
    </article>
  );
}

function EmployeesTab({
  employeeCards,
  navigation,
  departmentMap,
  searchText,
  onOpenDepartment,
}) {
  const visibleEmployees = filterEmployees(employeeCards, searchText);

  if (!navigation.employeeDepartmentId) {
    const departmentGroups = groupEmployeesByDepartment(
      visibleEmployees,
      departmentMap
    );

    if (!departmentGroups.length) {
      return <EmptyState title="No employee departments match your search." />;
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Employee Cards</div>
            <h2>Select a department</h2>
          </div>
        </div>

        <div className="department-grid">
          {departmentGroups.map((department) => (
            <DepartmentCard
              key={department.id}
              title={department.name}
              subtitle={`${department.employees.length} employee card${
                department.employees.length === 1 ? "" : "s"
              }`}
              icon={departmentIcon(department.id)}
              onClick={() => onOpenDepartment(department.id)}
            />
          ))}
        </div>
      </section>
    );
  }

  const selectedEmployees = visibleEmployees.filter(
    (employee) => employee.department_id === navigation.employeeDepartmentId
  );

  if (!selectedEmployees.length) {
    return <EmptyState title="No employee cards match your filters." />;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Employee Cards</div>
          <h2>
            {getDepartmentName(navigation.employeeDepartmentId, departmentMap)}
          </h2>
        </div>
      </div>

      <div className="employee-grid">
        {selectedEmployees.map((employee) => (
          <EmployeeCard key={employee.employee_email} employee={employee} />
        ))}
      </div>
    </section>
  );
}

function EmployeeCard({ employee }) {
  return (
    <article className="employee-card">
      <div className="employee-avatar">
        {getInitials(employee.employee_name || employee.employee_email)}
      </div>

      <div className="employee-card-body">
        <h3>{employee.employee_name || "Employee"}</h3>
        <p>{employee.title || "Title not listed"}</p>

        <div className="meta-stack">
          <span>{employee.employee_email}</span>
          <span>Department: {formatText(employee.department_id)}</span>
          <span>Subdepartment: {formatText(employee.subdepartment_id)}</span>
          <span>Access: {employee.access_level}</span>
        </div>
      </div>
    </article>
  );
}

function ProjectsTab({
  projects,
  navigation,
  searchText,
  onOpenProjectType,
  onOpenProject,
}) {
  const visibleProjects = filterProjects(projects, searchText);

  if (!navigation.projectTypeLabel) {
    const projectTypeGroups = groupProjectsByType(visibleProjects);

    if (!projectTypeGroups.length) {
      return <EmptyState title="No project insight groups match your search." />;
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Project Insights</div>
            <h2>Select a project type</h2>
          </div>
        </div>

        <div className="department-grid">
          {projectTypeGroups.map((group) => (
            <DepartmentCard
              key={group.label}
              title={group.label}
              subtitle={`${group.projects.length} project${
                group.projects.length === 1 ? "" : "s"
              } · ${group.tileCount} insight tile${
                group.tileCount === 1 ? "" : "s"
              }`}
              icon={projectTypeIcon(group.label)}
              onClick={() => onOpenProjectType(group.label)}
            />
          ))}
        </div>
      </section>
    );
  }

  const projectsForType = visibleProjects.filter(
    (project) => getProjectTypeLabel(project) === navigation.projectTypeLabel
  );

  if (!navigation.projectId) {
    if (!projectsForType.length) {
      return <EmptyState title="No projects match your filters." />;
    }

    return (
      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Project Files</div>
            <h2>{navigation.projectTypeLabel}</h2>
          </div>
        </div>

        <div className="card-grid">
          {projectsForType.map((project) => {
            const tileCount = (project.project_tiles || []).length;

            return (
              <article
                key={project.project_id}
                className="dashboard-card project-card"
              >
                <div className="card-top">
                  <div className="card-icon">
                    {projectTypeIcon(getProjectTypeLabel(project))}
                  </div>

                  <span className="status active">
                    {getProjectTypeLabel(project)}
                  </span>
                </div>

                <h3>{project.job_name || "Unnamed Project"}</h3>
                <p>Job #{project.job_number || "—"}</p>

                <div className="meta-stack">
                  <span>Program: {project.program_name || "—"}</span>
                  <span>Status: {project.status || "Active"}</span>
                  <span>
                    {tileCount} project insight tile
                    {tileCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="button primary"
                    onClick={() =>
                      onOpenProject(getProjectTypeLabel(project), project.project_id)
                    }
                  >
                    Open Project
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const selectedProject = projectsForType.find(
    (project) => project.project_id === navigation.projectId
  );

  if (!selectedProject) {
    return <EmptyState title="Selected project is not available." />;
  }

  const projectTiles = selectedProject.project_tiles || [];

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Project Insight Tiles</div>
          <h2>{selectedProject.job_name || "Unnamed Project"}</h2>
          <p className="muted">
            Job #{selectedProject.job_number || "—"} ·{" "}
            {getProjectTypeLabel(selectedProject)}
          </p>
        </div>
      </div>

      {projectTiles.length === 0 ? (
        <EmptyState title="No project insight tiles have been created for this project type yet." />
      ) : (
        <div className="card-grid">
          {projectTiles.map((tile) => (
            <article key={tile.project_tile_id} className="dashboard-card">
              <div className="card-top">
                <div className="card-icon">🏗️</div>

                <span
                  className={
                    tile.current_published_version_id || tile.artifact_url
                      ? "status active"
                      : "status pending"
                  }
                >
                  {tile.current_published_version_id || tile.artifact_url
                    ? tile.status || "Active"
                    : "Coming Soon"}
                </span>
              </div>

              <h3>{tile.tile_title}</h3>
              <p>
                {getProjectTypeLabel(selectedProject)} insight tile for{" "}
                {selectedProject.job_name}.
              </p>

              <div className="meta-stack">
                <span>
                  Project: {selectedProject.job_number || selectedProject.project_id}
                </span>
                <span>Tile key: {tile.tile_key}</span>
                <span>Type: {formatText(tile.artifact_type)}</span>
              </div>

              <div className="card-actions">
                <button className="button disabled" disabled>
                  Coming Soon
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DepartmentCard({ title, subtitle, icon, onClick }) {
  return (
    <button
      type="button"
      className="department-card department-card-button"
      onClick={onClick}
      aria-label={`Open ${title}`}
    >
      <div className="department-icon">{icon}</div>

      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </button>
  );
}

function StatCard({ label, value, small }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong className={small ? "small-stat" : ""}>{value}</strong>
    </div>
  );
}

function EmptyState({ title }) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>Try clearing your search or changing the selected filter.</p>
    </section>
  );
}

function FullPageLoading({ message, compact }) {
  return (
    <div className={compact ? "loading-inline" : "loading-page"}>
      <div className="loader" />
      <p>{message}</p>
    </div>
  );
}

function filterArtifacts(artifacts, searchText) {
  if (!searchText) {
    return artifacts;
  }

  return artifacts.filter((artifact) =>
    [
      artifact.artifact_id,
      artifact.tile_title,
      artifact.source_name,
      artifact.department_id,
      artifact.subdepartment_id,
      artifact.artifact_type,
      artifact.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchText)
  );
}

function filterEmployees(employees, searchText) {
  if (!searchText) {
    return employees;
  }

  return employees.filter((employee) =>
    [
      employee.employee_name,
      employee.employee_email,
      employee.title,
      employee.department_id,
      employee.subdepartment_id,
      employee.access_level,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchText)
  );
}

function filterProjects(projects, searchText) {
  if (!searchText) {
    return projects;
  }

  return projects.filter((project) => {
    const projectTilesText = (project.project_tiles || [])
      .map((tile) => [tile.tile_title, tile.tile_key, tile.status].join(" "))
      .join(" ");

    return [
      project.project_id,
      project.job_name,
      project.job_number,
      project.program_name,
      project.project_type_label,
      project.status,
      project.visible_to_raw,
      projectTilesText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchText);
  });
}

function groupArtifactsByDepartment(artifacts, departmentMap) {
  const groups = new Map();

  artifacts.forEach((artifact) => {
    const id = artifact.department_id || "other";

    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: getDepartmentName(id, departmentMap),
        artifacts: [],
      });
    }

    groups.get(id).artifacts.push(artifact);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function groupArtifactsBySubdepartment(artifacts, departmentId, departmentMap) {
  const groups = new Map();

  artifacts.forEach((artifact) => {
    const id = artifact.subdepartment_id || "__direct";
    const name =
      id === "__direct"
        ? `${getDepartmentName(departmentId, departmentMap)} General`
        : getDepartmentName(id, departmentMap);

    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name,
        artifacts: [],
        isDirect: id === "__direct",
      });
    }

    groups.get(id).artifacts.push(artifact);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function groupEmployeesByDepartment(employees, departmentMap) {
  const groups = new Map();

  employees.forEach((employee) => {
    const id = employee.department_id || "other";

    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: getDepartmentName(id, departmentMap),
        employees: [],
      });
    }

    groups.get(id).employees.push(employee);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function groupProjectsByType(projects) {
  const groups = new Map();

  projects.forEach((project) => {
    const label = getProjectTypeLabel(project);

    if (!groups.has(label)) {
      groups.set(label, {
        label,
        projects: [],
        tileCount: 0,
      });
    }

    groups.get(label).projects.push(project);
    groups.get(label).tileCount += (project.project_tiles || []).length;
  });

  return Array.from(groups.values()).sort((a, b) =>
    sortProjectType(a.label) - sortProjectType(b.label)
  );
}

function getProjectTypeLabel(project) {
  return project.project_type_label || project.program_name || "Unassigned";
}

function sortProjectType(label) {
  const order = {
    PSE: 1,
    "CS & D": 2,
    "Heavy Industrial": 3,
    "Food & Bev": 4,
    "Steel & Thermal": 5,
  };

  return order[label] || 99;
}

function getNavigationLabel(navigation, departmentMap, projects) {
  if (navigation.section === "overview") {
    return "Overview";
  }

  if (navigation.section === "dashboards") {
    if (!navigation.departmentId) {
      return "Dashboard Tiles → Departments";
    }

    if (!navigation.subdepartmentId) {
      return `Dashboard Tiles → ${getDepartmentName(
        navigation.departmentId,
        departmentMap
      )}`;
    }

    return `Dashboard Tiles → ${getDepartmentName(
      navigation.departmentId,
      departmentMap
    )} → ${getDepartmentName(navigation.subdepartmentId, departmentMap)}`;
  }

  if (navigation.section === "employees") {
    if (!navigation.employeeDepartmentId) {
      return "Employee Cards → Departments";
    }

    return `Employee Cards → ${getDepartmentName(
      navigation.employeeDepartmentId,
      departmentMap
    )}`;
  }

  if (navigation.section === "projects") {
    if (!navigation.projectTypeLabel) {
      return "Project Insights → Project Types";
    }

    if (!navigation.projectId) {
      return `Project Insights → ${navigation.projectTypeLabel}`;
    }

    const project = projects.find(
      (item) => item.project_id === navigation.projectId
    );

    return `Project Insights → ${navigation.projectTypeLabel} → ${
      project?.job_name || project?.job_number || "Project"
    }`;
  }

  return "Dashboard";
}

function getDepartmentName(departmentId, departmentMap) {
  if (!departmentId) {
    return "Unassigned";
  }

  if (departmentId === "__direct") {
    return "General";
  }

  return departmentMap.get(departmentId) || formatText(departmentId);
}

function departmentIcon(departmentId) {
  const icons = {
    corporate: "🏢",
    administration: "📊",
    finance: "💵",
    human_resources: "👥",
    compliance: "🛡️",
    ehs: "🛡️",
    project_controls: "📈",
    gc_ops: "🏗️",
    it: "💻",
    preconstruction: "📐",
    design_engineering: "📐",
    estimating: "🧮",
    program_management: "📋",
    marketing: "📣",
    cold_storage_distribution: "❄️",
    heavy_industrial: "🏭",
    food_beverage: "🍽️",
    cost_analytics: "📊",
    steel_thermal: "🔧",
  };

  return icons[departmentId] || "📁";
}

function projectTypeIcon(label) {
  const icons = {
    PSE: "📐",
    "CS & D": "❄️",
    "Heavy Industrial": "🏭",
    "Food & Bev": "🍽️",
    "Steel & Thermal": "🔧",
  };

  return icons[label] || "🏗️";
}

function formatText(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getInitials(value) {
  const words = String(value || "HRI")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "H";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function firstName(value) {
  return String(value || "there").split(" ")[0];
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

function summarizeBy(rows, fieldName) {
  const counts = new Map();

  rows.forEach((row) => {
    const key = row[fieldName] || "Unassigned";
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
