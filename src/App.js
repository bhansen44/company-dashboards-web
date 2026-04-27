import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const AUTH0_DOMAIN = "dev-r42hmecl0vnw6rr3.us.auth0.com";
const AUTH0_CLIENT_ID = "L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF";
const CONFIG_URL =
  "https://raw.githubusercontent.com/bhansen44/HRI-Dashboard/main/docs/artifacts/artifacts-config.json";

export default function App() {
  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
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
    error: authError,
  } = useAuth0();

  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch(CONFIG_URL);

        if (!response.ok) {
          throw new Error(`Config request failed with status ${response.status}`);
        }

        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error("Failed to load HRI artifact config:", error);
        setConfigError(error.message);
      }
    }

    loadConfig();
  }, []);

  const userProfile = useMemo(() => {
    if (!config || !user) {
      return null;
    }

    const email = normalizeEmail(user.email);
    const profile = config.users?.[email] || config.defaultUser;

    return {
      ...profile,
      email,
      displayName: profile?.name || user.name || user.email || "Employee",
      roles: profile?.roles || ["employee"],
      departments: profile?.departments || [],
      artifactIds: profile?.artifactIds || [],
    };
  }, [config, user]);

  const visibleArtifacts = useMemo(() => {
    if (!config || !userProfile) {
      return [];
    }

    return (config.artifacts || []).filter((artifact) =>
      canViewArtifact(userProfile, artifact)
    );
  }, [config, userProfile]);

  const visibleDepartments = useMemo(() => {
    if (!config) {
      return [];
    }

    const departmentIds = Array.from(
      new Set(visibleArtifacts.map((artifact) => artifact.department))
    );

    return departmentIds.map((departmentId) => ({
      id: departmentId,
      ...(config.departments?.[departmentId] || {
        name: departmentId,
        icon: "📁",
      }),
    }));
  }, [config, visibleArtifacts]);

  const filteredArtifacts = useMemo(() => {
    if (selectedDepartment === "all") {
      return visibleArtifacts;
    }

    return visibleArtifacts.filter(
      (artifact) => artifact.department === selectedDepartment
    );
  }, [selectedDepartment, visibleArtifacts]);

  const artifactsByDepartment = useMemo(() => {
    const grouped = {};

    filteredArtifacts.forEach((artifact) => {
      const departmentId = artifact.department || "other";

      if (!grouped[departmentId]) {
        grouped[departmentId] = [];
      }

      grouped[departmentId].push(artifact);
    });

    return grouped;
  }, [filteredArtifacts]);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📊 HRI Executive Dashboard</h1>
          <p>Role-based company dashboards and artifact links</p>

          {authError && (
            <pre className="error-box">Auth0 error: {authError.message}</pre>
          )}

          <button onClick={() => loginWithRedirect()} className="btn-primary">
            Sign In with Company Account
          </button>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="dashboard-layout">
        <header className="header hri-header">
          <div className="header-content">
            <h1>📊 HRI Executive Dashboard</h1>
            <button
              onClick={() =>
                logout({
                  logoutParams: {
                    returnTo: window.location.origin,
                  },
                })
              }
              className="btn-logout"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="no-tiles">
            <h2>Configuration could not be loaded</h2>
            <p>{configError}</p>
            <p className="text-muted">
              Check that artifacts-config.json exists in the HRI-Dashboard repo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!config || !userProfile) {
    return <div className="loading">Loading dashboard configuration...</div>;
  }

  return (
    <div className="dashboard-layout">
      <header className="header hri-header">
        <div className="header-content">
          <h1>📊 HRI Executive Dashboard</h1>

          <div className="header-user">
            <span className="user-name">
              {userProfile.displayName || user?.name || user?.email}
            </span>

            <span className="role-badge">
              {(userProfile.roles || []).join(", ")}
            </span>

            <button
              onClick={() =>
                logout({
                  logoutParams: {
                    returnTo: window.location.origin,
                  },
                })
              }
              className="btn-logout"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="kpi-banner">
          <div className="kpi-section">
            <h3>Access Summary</h3>

            <div className="kpi-grid">
              <div className="kpi-item">
                <div className="kpi-label">Visible Tiles</div>
                <div className="kpi-value">{visibleArtifacts.length}</div>
              </div>

              <div className="kpi-item">
                <div className="kpi-label">Departments</div>
                <div className="kpi-value">{visibleDepartments.length}</div>
              </div>

              <div className="kpi-item">
                <div className="kpi-label">Active Links</div>
                <div className="kpi-value">
                  {
                    visibleArtifacts.filter(
                      (artifact) => artifact.status === "active" && artifact.url
                    ).length
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="kpi-section">
            <h3>Signed In As</h3>

            <div className="kpi-grid">
              <div className="kpi-item">
                <div className="kpi-label">Name</div>
                <div className="kpi-value small-kpi">
                  {userProfile.displayName}
                </div>
              </div>

              <div className="kpi-item">
                <div className="kpi-label">Email</div>
                <div className="kpi-value small-kpi">
                  {userProfile.email}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="department-filter">
          <button
            className={`btn-refresh ${
              selectedDepartment === "all" ? "active-filter" : ""
            }`}
            onClick={() => setSelectedDepartment("all")}
          >
            All Departments
          </button>

          {visibleDepartments.map((department) => (
            <button
              key={department.id}
              className={`btn-refresh ${
                selectedDepartment === department.id ? "active-filter" : ""
              }`}
              onClick={() => setSelectedDepartment(department.id)}
            >
              {department.icon} {department.name}
            </button>
          ))}
        </section>

        {filteredArtifacts.length === 0 ? (
          <div className="no-tiles">
            <h2>No dashboards available for your current access.</h2>
            <p className="text-muted">
              This is expected for employees who have not yet been added to the
              permissions map.
            </p>
          </div>
        ) : (
          Object.entries(artifactsByDepartment).map(
            ([departmentId, departmentArtifacts]) => {
              const department = config.departments?.[departmentId] || {
                name: departmentId,
                icon: "📁",
              };

              return (
                <section key={departmentId} className="department-section">
                  <h2 className="department-heading">
                    {department.icon} {department.name}
                  </h2>

                  <div className="tiles-grid">
                    {departmentArtifacts.map((artifact) => (
                      <ArtifactTile
                        key={artifact.id}
                        artifact={artifact}
                        department={department}
                      />
                    ))}
                  </div>
                </section>
              );
            }
          )
        )}
      </main>
    </div>
  );
}

function ArtifactTile({ artifact, department }) {
  const isActive = artifact.status === "active" && artifact.url;

  return (
    <div className={`tile ${!isActive ? "refresh-due" : ""}`}>
      <div className="tile-header">
        <div className="tile-title">
          <span className="tile-icon">{department.icon}</span>
          <h3>{artifact.name}</h3>
        </div>

        <div className="tile-meta">
          <span className="cycle-badge">{artifact.refreshCycle}</span>
          {!isActive && <span className="due-badge">Coming Soon</span>}
        </div>
      </div>

      <div className="tile-body">
        <div className="tile-headline">{artifact.description}</div>

        <ul className="tile-insights">
          <li>Source: {artifact.source || "Not specified"}</li>
          <li>Type: {formatType(artifact.type)}</li>
          <li>Status: {artifact.status || "unknown"}</li>
        </ul>
      </div>

      <div className="tile-footer">
        <span className="refresh-time">ID: {artifact.id}</span>

        {isActive ? (
          <a
            href={artifact.url}
            target="_blank"
            rel="noreferrer"
            className="btn-refresh"
          >
            Open
          </a>
        ) : (
          <button className="btn-refresh" disabled>
            No Link Yet
          </button>
        )}
      </div>
    </div>
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function canViewArtifact(userProfile, artifact) {
  const roles = userProfile.roles || [];
  const departments = userProfile.departments || [];
  const artifactIds = userProfile.artifactIds || [];
  const allowedRoles = artifact.allowedRoles || [];

  if (roles.includes("admin") || roles.includes("executive")) {
    return true;
  }

  if (artifactIds.includes("all") || artifactIds.includes(artifact.id)) {
    return true;
  }

  if (departments.includes("all") || departments.includes(artifact.department)) {
    return true;
  }

  return allowedRoles.some((role) => roles.includes(role));
}

function formatType(type) {
  const labels = {
    claude_artifact: "Claude Artifact",
    powerbi: "Power BI",
  };

  return labels[type] || type || "Unknown";
}