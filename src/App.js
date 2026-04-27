import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import "./App.css";

const App = () => {
  return (
    <Auth0Provider
      domain="dev-r42hmecl0vnw6rr3.us.auth0.com"
      clientId="L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF"
      redirectUri={window.location.origin + "/callback"}
    >
      <Dashboard />
    </Auth0Provider>
  );
};

// Default department tiles configuration
const DEFAULT_TILES = [
  {
    id: "program_management",
    name: "Program Management",
    refreshCycle: "biweekly",
    icon: "📋",
    prompt: "Provide a senior analyst summary of Program Management KPIs: pipeline status, probability breakdown, top risks. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "program_management"],
  },
  {
    id: "gc_operations",
    name: "GC Operations",
    refreshCycle: "biweekly",
    icon: "🏗️",
    prompt: "Provide a senior analyst summary of GC Operations: bench depth, PM roster utilization, project health. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "gc_operations"],
  },
  {
    id: "steel_thermal",
    name: "Steel & Thermal",
    refreshCycle: "monthly",
    icon: "🔧",
    prompt: "Provide a senior analyst summary of Steel & Thermal division: GP gain/fade detail, production trends, market conditions. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "steel_thermal"],
  },
  {
    id: "preconstruction",
    name: "Preconstruction",
    refreshCycle: "biweekly",
    icon: "📐",
    prompt: "Provide a senior analyst summary of Preconstruction: bench depth, bids in progress, win rate. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "preconstruction"],
  },
  {
    id: "ehs_qa",
    name: "EHS-QA",
    refreshCycle: "weekly",
    icon: "🛡️",
    prompt: "Provide a senior analyst summary of EHS-QA: incident log, audit tracker, safety metrics. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "ehs_qa"],
  },
  {
    id: "administration",
    name: "Administration",
    refreshCycle: "monthly",
    icon: "📊",
    prompt: "Provide a senior analyst summary of Administration: corrective requirements, retention trend, operational metrics. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "administration"],
  },
  {
    id: "it",
    name: "IT",
    refreshCycle: "weekly",
    icon: "💻",
    prompt: "Provide a senior analyst summary of IT operations: breach log, uptime history, system health. Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION.",
    roles: ["admin", "it"],
  },
];

// Refresh cycle to days mapping
const CYCLE_DAYS = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  as_needed: Infinity,
};

const Dashboard = () => {
  const { loginWithRedirect, logout, user, isAuthenticated, isLoading } = useAuth0();
  const [userRole, setUserRole] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [tileData, setTileData] = useState({});
  const [refreshingTiles, setRefreshingTiles] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddTile, setShowAddTile] = useState(false);

  // Fetch user role from Auth0
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const role = user["https://dashboards.yourcompany.com/role"] || "employee";
    setUserRole(role);
    setIsAdmin(role === "admin");
  }, [isAuthenticated, user]);

  // Load tiles and cached data from localStorage
  useEffect(() => {
    if (!userRole) return;

    const savedTiles = localStorage.getItem("hri_tiles");
    const allTiles = savedTiles ? JSON.parse(savedTiles) : DEFAULT_TILES;

    const userTiles = allTiles.filter((tile) =>
      tile.roles.includes(userRole) || userRole === "admin"
    );

    setTiles(userTiles);

    const savedData = localStorage.getItem("hri_tile_data");
    if (savedData) {
      setTileData(JSON.parse(savedData));
    }
  }, [userRole]);

  const saveTileData = useCallback((newData) => {
    setTileData(newData);
    localStorage.setItem("hri_tile_data", JSON.stringify(newData));
  }, []);

  const needsRefresh = (tile) => {
    const data = tileData[tile.id];
    if (!data || !data.lastRefreshed) return true;

    const daysSince = (Date.now() - new Date(data.lastRefreshed).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= CYCLE_DAYS[tile.refreshCycle];
  };

  const refreshTile = async (tile) => {
    setRefreshingTiles((prev) => ({ ...prev, [tile.id]: true }));

    try {
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: tile.prompt }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.REACT_APP_ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        }
      );

      const content = response.data.content[0].text;
      const newData = {
        ...tileData,
        [tile.id]: {
          content,
          lastRefreshed: new Date().toISOString(),
        },
      };
      saveTileData(newData);
    } catch (error) {
      console.error("Failed to refresh tile:", error);
      const newData = {
        ...tileData,
        [tile.id]: {
          content: "HEADLINE: Configuration Needed\nKEY INSIGHTS:\n- API key not configured in Vercel\n- Add REACT_APP_ANTHROPIC_API_KEY environment variable\n- Redeploy to activate AI summaries\nRECOMMENDED ACTION: Add your Anthropic API key to Vercel environment variables",
          lastRefreshed: new Date().toISOString(),
          error: true,
        },
      };
      saveTileData(newData);
    } finally {
      setRefreshingTiles((prev) => ({ ...prev, [tile.id]: false }));
    }
  };

  const parseSummary = (content) => {
    if (!content) return null;

    const sections = {
      headline: "",
      insights: [],
      action: "",
    };

    const headlineMatch = content.match(/HEADLINE:?\s*([^\n]+)/i);
    if (headlineMatch) sections.headline = headlineMatch[1].trim();

    const insightsMatch = content.match(/KEY INSIGHTS:?\s*([\s\S]+?)(?=RECOMMENDED ACTION|$)/i);
    if (insightsMatch) {
      sections.insights = insightsMatch[1]
        .split("\n")
        .filter((line) => line.trim().match(/^[-•*\d]/))
        .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    const actionMatch = content.match(/RECOMMENDED ACTION:?\s*([^\n]+(?:\n(?![A-Z])[^\n]+)*)/i);
    if (actionMatch) sections.action = actionMatch[1].trim();

    return sections;
  };

  const formatLastRefresh = (isoDate) => {
    if (!isoDate) return "Never";
    const date = new Date(isoDate);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>📊 HRI Executive Dashboard</h1>
          <p>Senior management insights and analytics</p>
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
            <span className="user-name">{user.name}</span>
            <span className="role-badge">{userRole}</span>
            {isAdmin && (
              <button onClick={() => setShowAddTile(true)} className="btn-admin">
                + Add Tile
              </button>
            )}
            <button onClick={() => logout({ returnTo: window.location.origin })} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="kpi-banner">
          <div className="kpi-section">
            <h3>Trailing 12 Months</h3>
            <div className="kpi-grid">
              <div className="kpi-item">
                <div className="kpi-label">Revenue</div>
                <div className="kpi-value">$---M</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">GP</div>
                <div className="kpi-value">$---M</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">GP %</div>
                <div className="kpi-value">--%</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">GP Gain/Fade</div>
                <div className="kpi-value">$---</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">G&A vs Budget</div>
                <div className="kpi-value">$---</div>
              </div>
            </div>
          </div>
          <div className="kpi-section">
            <h3>12 Month Outlook</h3>
            <div className="kpi-grid">
              <div className="kpi-item">
                <div className="kpi-label">Proj. Revenue</div>
                <div className="kpi-value">$---M</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">Proj. GP</div>
                <div className="kpi-value">$---M</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">Proj. GP %</div>
                <div className="kpi-value">--%</div>
              </div>
              <div className="kpi-item">
                <div className="kpi-label">Proj. G&A Change</div>
                <div className="kpi-value">$---</div>
              </div>
            </div>
          </div>
        </div>

        <div className="tiles-grid">
          {tiles.length === 0 ? (
            <div className="no-tiles">
              <p>No dashboards available for your role.</p>
              <p className="text-muted">Contact your administrator for access.</p>
            </div>
          ) : (
            tiles.map((tile) => {
              const data = tileData[tile.id];
              const isRefreshing = refreshingTiles[tile.id];
              const refreshNeeded = needsRefresh(tile);
              const parsed = data ? parseSummary(data.content) : null;

              return (
                <div key={tile.id} className={`tile ${refreshNeeded ? "refresh-due" : ""}`}>
                  <div className="tile-header">
                    <div className="tile-title">
                      <span className="tile-icon">{tile.icon}</span>
                      <h3>{tile.name}</h3>
                    </div>
                    <div className="tile-meta">
                      <span className="cycle-badge">{tile.refreshCycle}</span>
                      {refreshNeeded && <span className="due-badge">⚠ Refresh Due</span>}
                    </div>
                  </div>

                  <div className="tile-body">
                    {isRefreshing ? (
                      <div className="tile-loading">
                        <div className="spinner"></div>
                        <p>Generating analysis...</p>
                      </div>
                    ) : parsed ? (
                      <>
                        {parsed.headline && (
                          <div className="tile-headline">{parsed.headline}</div>
                        )}
                        {parsed.insights.length > 0 && (
                          <ul className="tile-insights">
                            {parsed.insights.map((insight, i) => (
                              <li key={i}>{insight}</li>
                            ))}
                          </ul>
                        )}
                        {parsed.action && (
                          <div className="tile-action">
                            <strong>Action:</strong> {parsed.action}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="tile-empty">
                        <p>No data yet. Click refresh to generate summary.</p>
                      </div>
                    )}
                  </div>

                  <div className="tile-footer">
                    <span className="refresh-time">
                      Last: {formatLastRefresh(data?.lastRefreshed)}
                    </span>
                    <button
                      onClick={() => refreshTile(tile)}
                      disabled={isRefreshing}
                      className="btn-refresh"
                    >
                      {isRefreshing ? "..." : "⟳ Refresh"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {showAddTile && (
        <AddTileModal
          onClose={() => setShowAddTile(false)}
          onAdd={(newTile) => {
            const updated = [...tiles, newTile];
            setTiles(updated);
            localStorage.setItem("hri_tiles", JSON.stringify(updated));
            setShowAddTile(false);
          }}
        />
      )}
    </div>
  );
};

const AddTileModal = ({ onClose, onAdd }) => {
  const [name, setName] = useState("");
  const [refreshCycle, setRefreshCycle] = useState("weekly");
  const [prompt, setPrompt] = useState("");
  const [roles, setRoles] = useState("admin");

  const handleSubmit = () => {
    if (!name || !prompt) return;

    onAdd({
      id: name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now(),
      name,
      refreshCycle,
      icon: "📈",
      prompt,
      roles: roles.split(",").map((r) => r.trim()),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add New Tile</h2>
        <div className="form-group">
          <label>Tile Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sales Pipeline" />
        </div>
        <div className="form-group">
          <label>Refresh Cycle</label>
          <select value={refreshCycle} onChange={(e) => setRefreshCycle(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="as_needed">As Needed</option>
          </select>
        </div>
        <div className="form-group">
          <label>AI Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Provide a senior analyst summary of... Format as HEADLINE, KEY INSIGHTS (3 bullets), RECOMMENDED ACTION."
            rows={4}
          />
        </div>
        <div className="form-group">
          <label>Roles (comma-separated)</label>
          <input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="admin, sales, manager" />
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary">Add Tile</button>
        </div>
      </div>
    </div>
  );
};

export default App;
