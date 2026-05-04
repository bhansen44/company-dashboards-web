let jwksCache = null;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function verifyAuth0Token(token) {
  const { createRemoteJWKSet, jwtVerify } = await import("jose");

  const auth0Domain = getRequiredEnv("AUTH0_DOMAIN");
  const auth0ClientId = getRequiredEnv("AUTH0_CLIENT_ID");

  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(
      new URL(`https://${auth0Domain}/.well-known/jwks.json`)
    );
  }

  const { payload } = await jwtVerify(token, jwksCache, {
    issuer: `https://${auth0Domain}/`,
    audience: auth0ClientId,
  });

  return payload;
}

async function supabaseSelect(tableName, queryString = "?select=*") {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(
    `${supabaseUrl}/rest/v1/${tableName}${queryString}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Supabase request failed for ${tableName}: ${response.status} ${text}`
    );
  }

  return response.json();
}

function makeSet(rows, accessType) {
  return new Set(
    rows
      .filter((row) => row.access_type === accessType)
      .map((row) => row.access_value)
  );
}

function isArchivedRow(row) {
  const tileGroup = String(row?.tile_group || "").trim().toLowerCase();
  const status = String(row?.status || "").trim().toLowerCase();

  return tileGroup === "archived" || status === "archived";
}

function safeEmployeeCard(employee) {
  ...
}function safeEmployeeCard(employee) {
  return {
    employee_email: employee.employee_email,
    employee_name: employee.employee_name,
    title: employee.title,
    employee_code: employee.employee_code,
    department_id: employee.department_id,
    subdepartment_id: employee.subdepartment_id,
    access_level: employee.access_level,
  };
}

function sortArtifacts(a, b) {
  const deptCompare = String(a.department_id || "").localeCompare(
    String(b.department_id || "")
  );

  if (deptCompare !== 0) return deptCompare;

  const subCompare = String(a.subdepartment_id || "").localeCompare(
    String(b.subdepartment_id || "")
  );

  if (subCompare !== 0) return subCompare;

  return Number(a.sort_order || 999) - Number(b.sort_order || 999);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return res.status(401).json({
        error: "Missing bearer token",
      });
    }

    const claims = await verifyAuth0Token(token);
    const email = String(claims.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(403).json({
        error: "Auth0 token did not include an email address.",
      });
    }

    const employeeRows = await supabaseSelect(
      "hri_employees",
      `?employee_email=eq.${encodeURIComponent(email)}&select=*`
    );

    const currentEmployee = employeeRows[0];

    if (!currentEmployee) {
      return res.status(403).json({
        error: "User not found in HRI permissions table.",
        email,
      });
    }

    if (!currentEmployee.can_login) {
      return res.status(403).json({
        error: "User is not currently invited for dashboard access.",
        email,
        active_status: currentEmployee.active_status,
        current_invite: currentEmployee.current_invite,
        access_level: currentEmployee.access_level,
      });
    }

    const [
      departments,
      artifacts,
      dashboardAccessRows,
      cardAccessRows,
      allEmployees,
      projects,
      projectAccessRules,
      projectTiles,
    ] = await Promise.all([
      supabaseSelect("hri_departments", "?select=*"),
      supabaseSelect("hri_artifacts", "?select=*"),
      supabaseSelect(
        "hri_employee_dashboard_access",
        `?employee_email=eq.${encodeURIComponent(
          email
        )}&select=access_type,access_value`
      ),
      supabaseSelect(
        "hri_employee_card_access",
        `?employee_email=eq.${encodeURIComponent(
          email
        )}&select=scope,scope_value`
      ),
      supabaseSelect("hri_employees", "?select=*"),
      supabaseSelect("hri_projects", "?select=*"),
      supabaseSelect("hri_project_access_rules", "?select=*"),
      supabaseSelect("hri_project_tiles", "?select=*"),
    ]);

    const roles = makeSet(dashboardAccessRows, "role");
    const departmentsAllowed = makeSet(dashboardAccessRows, "department");
    const subdepartmentsAllowed = makeSet(
      dashboardAccessRows,
      "subdepartment"
    );
    const artifactsAllowed = makeSet(dashboardAccessRows, "artifact");
    const projectsAllowed = makeSet(dashboardAccessRows, "project");

    const canSeeAll =
      roles.has("executive") ||
      roles.has("admin") ||
      artifactsAllowed.has("all") ||
      departmentsAllowed.has("all") ||
      subdepartmentsAllowed.has("all");

    const activeArtifacts = (artifacts || []).filter(
  (artifact) => !isArchivedRow(artifact)
);

const visibleArtifacts = activeArtifacts
  .filter((artifact) => {
        if (canSeeAll) return true;
        if (artifactsAllowed.has(artifact.artifact_id)) return true;
        if (departmentsAllowed.has(artifact.department_id)) return true;
        if (subdepartmentsAllowed.has(artifact.subdepartment_id)) return true;
        return false;
      })
      .sort(sortArtifacts);

    const projectRulesByProject = new Map();

    for (const rule of projectAccessRules) {
      if (!projectRulesByProject.has(rule.project_id)) {
        projectRulesByProject.set(rule.project_id, []);
      }

      projectRulesByProject.get(rule.project_id).push(rule);
    }

    const visibleProjectsBase = projects
      .filter((project) => {
        if (projectsAllowed.has("all") || roles.has("executive") || roles.has("admin")) {
          return true;
        }

        const rules = projectRulesByProject.get(project.project_id) || [];

        return rules.some((rule) => {
          if (rule.access_type === "role") {
            return roles.has(rule.access_value);
          }

          if (rule.access_type === "program") {
            return (
              departmentsAllowed.has(rule.access_value) ||
              subdepartmentsAllowed.has(rule.access_value)
            );
          }

          if (rule.access_type === "employee") {
            return rule.access_value === email;
          }

          return false;
        });
      })
      .sort((a, b) => {
        const programCompare = String(a.program_name || "").localeCompare(
          String(b.program_name || "")
        );
        if (programCompare !== 0) return programCompare;
        return String(a.job_name || "").localeCompare(String(b.job_name || ""));
      });

    const visibleProjectIds = new Set(
      visibleProjectsBase.map((project) => project.project_id)
    );

    const projectTilesByProject = new Map();

    for (const tile of projectTiles) {
      if (!visibleProjectIds.has(tile.project_id)) {
        continue;
      }

      if (!projectTilesByProject.has(tile.project_id)) {
        projectTilesByProject.set(tile.project_id, []);
      }

      projectTilesByProject.get(tile.project_id).push(tile);
    }

    for (const tiles of projectTilesByProject.values()) {
      tiles.sort(
        (a, b) => Number(a.sort_order || 999) - Number(b.sort_order || 999)
      );
    }

    const visibleProjects = visibleProjectsBase.map((project) => ({
      ...project,
      project_tiles: projectTilesByProject.get(project.project_id) || [],
    }));

    const activeEmployees = allEmployees.filter(
      (employee) => employee.is_active
    );

    const hasAllEmployeeCards = cardAccessRows.some(
      (row) => row.scope === "all" && row.scope_value === "all"
    );

    const canSeeOwnCard = cardAccessRows.some(
      (row) => row.scope === "individual" && row.scope_value === "self"
    );

    const employeeCardGroups = new Set(
      cardAccessRows
        .filter((row) => row.scope === "group")
        .map((row) => row.scope_value)
    );

    const visibleEmployeeCards = activeEmployees
      .filter((employee) => {
        if (hasAllEmployeeCards) return true;

        if (canSeeOwnCard && employee.employee_email === email) {
          return true;
        }

        if (employeeCardGroups.has(employee.department_id)) {
          return true;
        }

        if (employeeCardGroups.has(employee.subdepartment_id)) {
          return true;
        }

        return false;
      })
      .map(safeEmployeeCard)
      .sort((a, b) =>
        String(a.employee_name || "").localeCompare(
          String(b.employee_name || "")
        )
      );
const projectsForResponse = (visibleProjects || []).map((project) => ({
  ...project,
  project_tiles: Array.isArray(project.project_tiles)
    ? project.project_tiles.filter((tile) => !isArchivedRow(tile))
    : [],
}));

const projectTileCountForResponse = projectsForResponse.reduce(
  (sum, project) => sum + (project.project_tiles || []).length,
  0
);
    return res.status(200).json({
      user: {
        email,
        name: currentEmployee.employee_name,
        title: currentEmployee.title,
        employee_code: currentEmployee.employee_code,
        access_level: currentEmployee.access_level,
        landing_page: currentEmployee.landing_page,
        employee_card_access_raw: currentEmployee.employee_card_access_raw,
      },
     counts: {
  artifacts: visibleArtifacts.length,
  employeeCards: visibleEmployeeCards.length,
  projects: projectsForResponse.length,
  projectTiles: projectTileCountForResponse,
},
      access: {
        dashboardAccess: dashboardAccessRows,
        employeeCardAccess: cardAccessRows,
      },
      departments,
      artifacts: visibleArtifacts,
      employeeCards: visibleEmployeeCards,
     projects: projectsForResponse,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
};