import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import "./App.css";

const AUTH0_DOMAIN = "dev-r42hmecl0vnw6rr3.us.auth0.com";
const AUTH0_CLIENT_ID = "L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF";
const CONFIG_URL =
  "https://raw.githubusercontent.com/bhansen44/HRI-Dashboard/main/docs/artifacts/artifacts-config.json";

function Dashboard() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading,
    error: authError,
  } = useAuth0();

  const [userRole, setUserRole] = useState("employee");
  const [config, setConfig] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(CONFIG_URL);

        if (!response.ok) {
          throw new Error(`Config request failed with status ${response.status}`);
        }

        const data = await response.json();
        setConfig(data);
      } catch (error) {
        console.error("Failed to load dashboard configuration:", error);
        setConfigError("Failed to load dashboard configuration.");
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const roleFromToken =
      user["https://dashboards.yourcompany.com/role"] ||
      user["https://hri-dashboard/role"] ||
      "employee";

    setUserRole(roleFromToken);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!config || !userRole) {
      return;
    }

    const roleConfig = config.roles?.[userRole] || config.roles?.employee;

    if (!roleConfig || !Array.isArray(roleConfig.dashboards)) {
      setDashboards([]);
      setSelectedDashboard(null);
      return;
    }

    const userDashboards = roleConfig.dashboards
      .map((dashboardId) => {
        const artifact = config.artifacts?.[dashboardId];

        if (!artifact) {
          return null;
        }

        return {
          id: dashboardId,
          ...artifact,
        };
      })
      .filter(Boolean);

    setDashboards(userDashboards);

    setSelectedDashboard((currentDashboard) => {
      if (
        currentDashboard &&
        userDashboards.some((dashboard) => dashboard.id === currentDashboard.id)
      ) {
        return currentDashboard;
      }

      return userDashboards[0] || null;
    });
  }, [config, userRole]);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📊 Company Dashboards</h1>
          <p>Employee analytics and insights</p>

          {authError && (
            <pre className="error-box">
              Auth0 error: {authError.message}
            </pre>
          )}

          <button onClick={() => loginWithRedirect()} className="btn-primary">
            Sign In with Company Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <header className="header">
        <div className="header-content">
          <h1>📊 Company Dashboards</h1>

          <div className="header-user">
            <span>{user?.name || user?.email}</span>
            <span className="role-badge">{userRole}</span>

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

      <div className="main-layout">
        <aside className="sidebar">
          <nav>
            <h3>Your Dashboards</h3>

            {configError && <p className="error-text">{configError}</p>}

            {!configError && dashboards.length === 0 && (
              <p className="empty-text">
                No dashboards are available for your role yet.
              </p>
            )}

            <ul>
              {dashboards.map((dashboard) => (
                <li key={dashboard.id}>
                  <button
                    className={`nav-item ${
                      selectedDashboard?.id === dashboard.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedDashboard(dashboard)}
                  >
                    {dashboard.name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          {selectedDashboard ? (
            <div className="dashboard-container">
              <h2>{selectedDashboard.name}</h2>

              {selectedDashboard.description && (
                <p className="dashboard-desc">
                  {selectedDashboard.description}
                </p>
              )}

              <iframe
                key={selectedDashboard.id}
                src={selectedDashboard.url}
                title={selectedDashboard.name}
                className="dashboard-iframe"
              />
            </div>
          ) : (
            <div className="no-dashboards">
              <h2>No dashboard selected</h2>
              <p>
                If this is unexpected, check your artifact configuration file and
                role settings.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

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