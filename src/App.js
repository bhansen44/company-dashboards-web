import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const AUTH0_DOMAIN = "dev-r42hmecl0vnw6rr3.us.auth0.com";
const AUTH0_CLIENT_ID = "L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF";

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
  const [activeTab, setActiveTab] = useState("overview");
  const [searchText, setSearchText] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");

  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setApiLoading(true);
    setApiError(null);

    try {
      const claims = await getIdTokenClaims();
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

  const artifactsByDepartment = useMemo(() => {
    const grouped = {};

    (dashboardData?.artifacts || []).forEach((artifact) => {
      const departmentId = artifact.department_id || "other";

      if (!grouped[departmentId]) {
        grouped[departmentId] = [];
      }

      grouped[departmentId].push(artifact);
    });

    return grouped;
  }, [dashboardData]);

  const visibleDepartmentOptions = useMemo(() => {
    const departments = Object.keys(artifactsByDepartment).map(
      (departmentId) => ({
        id: departmentId,
        name: getDepartmentName(departmentId, departmentMap),
        count: artifactsByDepartment[departmentId].length,
      })
    );

    return departments.sort((a, b) => a.name.localeCompare(b.name));
  }, [artifactsByDepartment, departmentMap]);

  const filteredArtifacts = useMemo(() => {
    return (dashboardData?.artifacts || []).filter((artifact) => {
      const haystack = [
        artifact.artifact_id,
        artifact.tile_title,
        artifact.source_name,
        artifact.department_id,
        artifact.artifact_type,
        artifact.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || haystack.includes(normalizedSearch);

      const matchesDepartment =
        selectedDepartment === "all" ||
        artifact.department_id === selectedDepartment;

      return matchesSearch && matchesDepartment;
    });
  }, [dashboardData, normalizedSearch, selectedDepartment]);

  const filteredEmployeeCards = useMemo(() => {
    return (dashboardData?.employeeCards || []).filter((employee) => {
      const haystack = [
        employee.employee_name,
        employee.employee_email,
        employee.title,
        employee.department_id,
        employee.subdepartment_id,
        employee.access_level,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !normalizedSearch || haystack.includes(normalizedSearch);
    });
  }, [dashboardData, normalizedSearch]);

  const programOptions = useMemo(() => {
    const programs = new Map();

    (dashboardData?.projects || []).forEach((project) => {
      const key = project.program_name || "Unassigned";
      programs.set(key, (programs.get(key) || 0) + 1);
    });

    return Array.from(programs.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dashboardData]);

  const filteredProjects = useMemo(() => {
    return (dashboardData?.projects || []).filter((project) => {
      const haystack = [
        project.project_id,
        project.job_name,
        project.job_number,
        project.program_name,
        project.status,
        project.visible_to_raw,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || haystack.includes(normalizedSearch);

      const matchesProgram =
        selectedProgram === "all" || project.program_name === selectedProgram;

      return matchesSearch && matchesProgram;
    });
  }, [dashboardData, normalizedSearch, selectedProgram]);

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
            <HeroSection dashboardData={dashboardData} />

            <nav className="tabbar" aria-label="Dashboard sections">
              <button
                className={activeTab === "overview" ? "active" : ""}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>

              <button
                className={activeTab === "dashboards" ? "active" : ""}
                onClick={() => setActiveTab("dashboards")}
              >
                Dashboard Tiles
              </button>

              <button
                className={activeTab === "employees" ? "active" : ""}
                onClick={() => setActiveTab("employees")}
              >
                Employee Cards
              </button>

              <button
                className={activeTab === "projects" ? "active" : ""}
                onClick={() => setActiveTab("projects")}
              >
                Project Tabs
              </button>
            </nav>

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

              {activeTab === "dashboards" && (
                <div>
                  <label htmlFor="department-filter">Department</label>
                  <select
                    id="department-filter"
                    value={selectedDepartment}
                    onChange={(event) =>
                      setSelectedDepartment(event.target.value)
                    }
                  >
                    <option value="all">All departments</option>

                    {visibleDepartmentOptions.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === "projects" && (
                <div>
                  <label htmlFor="program-filter">Program</label>
                  <select
                    id="program-filter"
                    value={selectedProgram}
                    onChange={(event) => setSelectedProgram(event.target.value)}
                  >
                    <option value="all">All programs</option>

                    {programOptions.map((program) => (
                      <option key={program.name} value={program.name}>
                        {program.name} ({program.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {activeTab === "overview" && (
              <OverviewTab
                dashboardData={dashboardData}
                artifactsByDepartment={artifactsByDepartment}
                departmentMap={departmentMap}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "dashboards" && (
              <DashboardsTab
                artifacts={filteredArtifacts}
                departmentMap={departmentMap}
              />
            )}

            {activeTab === "employees" && (
              <EmployeesTab employeeCards={filteredEmployeeCards} />
            )}

            {activeTab === "projects" && (
              <ProjectsTab projects={filteredProjects} />
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
          pages, and generated business artifacts.
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

function HeroSection({ dashboardData }) {
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
        <StatCard label="Project Tabs" value={dashboardData.counts.projects} />
        <StatCard
          label="Card Scope"
          value={user?.employee_card_access_raw || "None"}
          small
        />
      </div>
    </section>
  );
}

function OverviewTab({
  dashboardData,
  artifactsByDepartment,
  departmentMap,
  setActiveTab,
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

          <button
            className="button ghost"
            onClick={() => setActiveTab("dashboards")}
          >
            View all dashboards
          </button>
        </div>

        <div className="department-grid">
          {departments.map((department) => (
            <div key={department.id} className="department-card">
              <div className="department-icon">
                {departmentIcon(department.id)}
              </div>

              <div>
                <h3>{department.name}</h3>
                <p>
                  {department.artifacts.length} accessible dashboard tile
                  {department.artifacts.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Visible Projects</div>
            <h2>Program access</h2>
          </div>
        </div>

        <div className="mini-list">
          {summarizeBy(dashboardData.projects || [], "program_name").map(
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

function DashboardsTab({ artifacts, departmentMap }) {
  if (!artifacts.length) {
    return <EmptyState title="No dashboard tiles match your filters." />;
  }

  return (
    <div className="card-grid">
      {artifacts.map((artifact) => (
        <article key={artifact.artifact_id} className="dashboard-card">
          <div className="card-top">
            <div className="card-icon">
              {departmentIcon(artifact.department_id)}
            </div>

            <span className={artifact.artifact_url ? "status active" : "status pending"}>
              {artifact.artifact_url ? artifact.status || "Active" : "Coming Soon"}
            </span>
          </div>

          <h3>{artifact.tile_title || artifact.artifact_id}</h3>
          <p>{artifact.source_name || "Dashboard artifact"}</p>

          <div className="meta-stack">
            <span>
              Department:{" "}
              {getDepartmentName(artifact.department_id, departmentMap)}
            </span>
            <span>Type: {formatText(artifact.artifact_type)}</span>
            <span>ID: {artifact.artifact_id}</span>
          </div>

          <div className="card-actions">
            {artifact.artifact_url ? (
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
                Link Coming Soon
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function EmployeesTab({ employeeCards }) {
  if (!employeeCards.length) {
    return <EmptyState title="No employee cards match your filters." />;
  }

  return (
    <div className="employee-grid">
      {employeeCards.map((employee) => (
        <article key={employee.employee_email} className="employee-card">
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
      ))}
    </div>
  );
}

function ProjectsTab({ projects }) {
  if (!projects.length) {
    return <EmptyState title="No project tabs match your filters." />;
  }

  return (
    <div className="project-table-wrap">
      <table className="project-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Job #</th>
            <th>Program</th>
            <th>Status</th>
            <th>Visible To</th>
          </tr>
        </thead>

        <tbody>
          {projects.map((project) => (
            <tr key={project.project_id}>
              <td>
                <strong>{project.job_name || "Unnamed Project"}</strong>
              </td>
              <td>{project.job_number || "—"}</td>
              <td>{project.program_name || "—"}</td>
              <td>
                <span className="status active">
                  {project.status || "Active"}
                </span>
              </td>
              <td>{project.visible_to_raw || "Permission rule"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function getDepartmentName(departmentId, departmentMap) {
  if (!departmentId) {
    return "Unassigned";
  }

  return departmentMap.get(departmentId) || formatText(departmentId);
}

function departmentIcon(departmentId) {
  const icons = {
    program_management: "📋",
    gc_ops: "🏗️",
    steel_thermal: "🔧",
    preconstruction: "📐",
    compliance: "🛡️",
    administration: "📊",
    it: "💻",
  };

  return icons[departmentId] || "📁";
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