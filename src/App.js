import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useState } from "react";
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

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📊 HRI Executive Dashboard</h1>
          <p>Role-based dashboards, employee cards, and project access.</p>

          <button onClick={() => loginWithRedirect()} className="btn-primary">
            Sign In with Company Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <header className="header hri-header">
        <div className="header-content">
          <h1>📊 HRI Executive Dashboard</h1>

          <div className="header-user">
            <span className="user-name">
              {dashboardData?.user?.name || user?.name || user?.email}
            </span>

            {dashboardData?.user?.access_level && (
              <span className="role-badge">
                {dashboardData.user.access_level}
              </span>
            )}

            <button onClick={loadDashboardData} className="btn-admin">
              Refresh
            </button>

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
        {apiLoading && <div className="loading">Loading permissions...</div>}

        {apiError && (
          <div className="no-tiles">
            <h2>Permission or API issue</h2>
            <p>{apiError}</p>
            <p className="text-muted">
              This usually means the user is not marked Current Invite = Yes, or
              a Vercel/Supabase environment variable is missing.
            </p>
          </div>
        )}

        {dashboardData && (
          <>
            <section className="kpi-banner">
              <div className="kpi-section">
                <h3>Access Summary</h3>

                <div className="kpi-grid">
                  <div className="kpi-item">
                    <div className="kpi-label">Dashboard Tiles</div>
                    <div className="kpi-value">
                      {dashboardData.counts.artifacts}
                    </div>
                  </div>

                  <div className="kpi-item">
                    <div className="kpi-label">Employee Cards</div>
                    <div className="kpi-value">
                      {dashboardData.counts.employeeCards}
                    </div>
                  </div>

                  <div className="kpi-item">
                    <div className="kpi-label">Project Tabs</div>
                    <div className="kpi-value">
                      {dashboardData.counts.projects}
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
                      {dashboardData.user.name}
                    </div>
                  </div>

                  <div className="kpi-item">
                    <div className="kpi-label">Access</div>
                    <div className="kpi-value small-kpi">
                      {dashboardData.user.access_level}
                    </div>
                  </div>

                  <div className="kpi-item">
                    <div className="kpi-label">Cards</div>
                    <div className="kpi-value small-kpi">
                      {dashboardData.user.employee_card_access_raw}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="department-heading">Dashboard Tiles</h2>

              <div className="tiles-grid">
                {dashboardData.artifacts.map((artifact) => (
                  <div key={artifact.artifact_id} className="tile">
                    <div className="tile-header">
                      <div className="tile-title">
                        <span className="tile-icon">📊</span>
                        <h3>{artifact.tile_title}</h3>
                      </div>

                      <div className="tile-meta">
                        <span className="cycle-badge">
                          {artifact.status || "unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="tile-body">
                      <div className="tile-headline">
                        {artifact.source_name || "Dashboard Artifact"}
                      </div>

                      <ul className="tile-insights">
                        <li>Department: {artifact.department_id}</li>
                        <li>Type: {artifact.artifact_type}</li>
                        <li>Storage key: {artifact.storage_key || "None"}</li>
                      </ul>
                    </div>

                    <div className="tile-footer">
                      <span className="refresh-time">
                        ID: {artifact.artifact_id}
                      </span>

                      {artifact.artifact_url ? (
                        <a
                          href={artifact.artifact_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-refresh"
                        >
                          Open
                        </a>
                      ) : (
                        <button className="btn-refresh" disabled>
                          Coming Soon
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginTop: "2rem" }}>
              <h2 className="department-heading">Employee Cards Visible</h2>

              <div className="tiles-grid">
                {dashboardData.employeeCards.map((employee) => (
                  <div key={employee.employee_email} className="tile">
                    <div className="tile-header">
                      <div className="tile-title">
                        <span className="tile-icon">👤</span>
                        <h3>{employee.employee_name}</h3>
                      </div>
                    </div>

                    <div className="tile-body">
                      <div className="tile-headline">
                        {employee.title || "Employee"}
                      </div>

                      <ul className="tile-insights">
                        <li>Email: {employee.employee_email}</li>
                        <li>Department: {employee.department_id}</li>
                        <li>Subdepartment: {employee.subdepartment_id}</li>
                        <li>Access level: {employee.access_level}</li>
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginTop: "2rem" }}>
              <h2 className="department-heading">Project Tabs Visible</h2>

              <div className="tiles-grid">
                {dashboardData.projects.map((project) => (
                  <div key={project.project_id} className="tile">
                    <div className="tile-header">
                      <div className="tile-title">
                        <span className="tile-icon">🏗️</span>
                        <h3>{project.job_name}</h3>
                      </div>
                    </div>

                    <div className="tile-body">
                      <ul className="tile-insights">
                        <li>Job number: {project.job_number}</li>
                        <li>Program: {project.program_name}</li>
                        <li>Status: {project.status}</li>
                        <li>Visible to: {project.visible_to_raw}</li>
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}