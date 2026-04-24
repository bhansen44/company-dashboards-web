import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const App = () => {
  return (
    <Auth0Provider
      domain="dev-r42hmecl0vnw6rr3.us.auth0.com"
      clientId="VFuP90ME9vCKwSnRr49mBXuB3IGrRf4"
      redirectUri={window.location.origin + "/callback"}
    >
      <Dashboard />
    </Auth0Provider>
  );
};

const Dashboard = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [userRole, setUserRole] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [config, setConfig] = useState(null);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [error, setError] = useState(null);

  // Load config from GitHub
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await axios.get(process.env.REACT_APP_CONFIG_URL);
        setConfig(response.data);
      } catch (error) {
        console.error("Failed to load config:", error);
        setError("Failed to load dashboard configuration");
      }
    };
    loadConfig();
  }, []);

  // Fetch user role from Auth0 claims
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchUserRole = async () => {
      try {
        // Get the role from Auth0 claims
        
        
        // Check ID token for custom claims (set in Auth0 Rules)
        const role = user["https://dashboards.yourcompany.com/role"] || "employee";
        setUserRole(role);
      } catch (error) {
        console.error("Failed to fetch user role:", error);
        setUserRole("employee");
      }
    };

    fetchUserRole();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  // Get dashboards for user's role
  useEffect(() => {
    if (!config || !userRole) return;

    const roleConfig = config.roles[userRole];
    if (!roleConfig) {
      setDashboards([]);
      return;
    }

    const userDashboards = roleConfig.dashboards
      .map((dashName) => {
        const artifact = config.artifacts[dashName];
        if (!artifact) return null;
        return {
          id: dashName,
          ...artifact,
        };
      })
      .filter(Boolean);

    setDashboards(userDashboards);
    if (userDashboards.length > 0 && !selectedDashboard) {
      setSelectedDashboard(userDashboards[0]);
    }
  }, [config, userRole, selectedDashboard]);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📊 Company Dashboards</h1>
          <p>Employee analytics and insights</p>
          <button onClick={() => loginWithRedirect()} className="btn-primary">
            Sign In with Company Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>📊 Company Dashboards</h1>
          <div className="header-user">
            <span className="user-name">{user.name}</span>
            <span className="role-badge">{userRole || "loading..."}</span>
            <button onClick={() => logout({ returnTo: window.location.origin })} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav>
            <h3>Your Dashboards</h3>
            {dashboards.length > 0 ? (
              <ul>
                {dashboards.map((dashboard) => (
                  <li key={dashboard.id}>
                    <button
                      className={`nav-item ${selectedDashboard?.id === dashboard.id ? "active" : ""}`}
                      onClick={() => setSelectedDashboard(dashboard)}
                    >
                      {dashboard.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-dashboards-text">No dashboards available</p>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {error && <div className="error-message">{error}</div>}

          {selectedDashboard ? (
            <div className="dashboard-container">
              <div className="dashboard-header">
                <h2>{selectedDashboard.name}</h2>
                {selectedDashboard.description && (
                  <p className="dashboard-desc">{selectedDashboard.description}</p>
                )}
              </div>
              <div className="dashboard-wrapper">
                <iframe
                  key={selectedDashboard.id}
                  src={selectedDashboard.url}
                  title={selectedDashboard.name}
                  className="dashboard-iframe"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            </div>
          ) : (
            <div className="no-content">
              <p>No dashboards available for your role.</p>
              <p className="text-muted">Contact your administrator if you need access to additional dashboards.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
