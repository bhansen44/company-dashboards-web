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

async function supabaseRequest(path) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function downloadStorageObject(bucket, storagePath) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${storagePath}`;

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Storage download failed: ${response.status} ${text}`);
  }

  return response.text();
}

function makeSet(rows, accessType) {
  return new Set(
    rows
      .filter((row) => row.access_type === accessType)
      .map((row) => row.access_value)
  );
}

function canUserViewArtifact({ employee, artifact, dashboardAccessRows }) {
  if (!employee || !employee.can_login) {
    return false;
  }

  const roles = makeSet(dashboardAccessRows, "role");
  const departments = makeSet(dashboardAccessRows, "department");
  const artifacts = makeSet(dashboardAccessRows, "artifact");

  if (roles.has("executive") || roles.has("admin")) {
    return true;
  }

  if (departments.has("all") || artifacts.has("all")) {
    return true;
  }

  if (artifacts.has(artifact.artifact_id)) {
    return true;
  }

  if (departments.has(artifact.department_id)) {
    return true;
  }

  return false;
}

function canUserViewPreview({ dashboardAccessRows }) {
  const roles = makeSet(dashboardAccessRows, "role");
  return roles.has("executive") || roles.has("admin");
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const artifactId = String(req.query.artifactId || "").trim();
    const stage = String(req.query.stage || "published").trim();

    if (!artifactId) {
      return res.status(400).json({ error: "Missing artifactId" });
    }

    if (!["published", "preview"].includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";

    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const claims = await verifyAuth0Token(token);
    const email = String(claims.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(403).json({
        error: "Auth0 token did not include an email address.",
      });
    }

    const employeeRows = await supabaseRequest(
      `hri_employees?employee_email=eq.${encodeURIComponent(email)}&select=*`
    );

    const employee = employeeRows[0];

    if (!employee || !employee.can_login) {
      return res.status(403).json({
        error: "User is not currently invited for dashboard access.",
        email,
      });
    }

    const artifactRows = await supabaseRequest(
      `hri_artifacts?artifact_id=eq.${encodeURIComponent(artifactId)}&select=*`
    );

    const artifact = artifactRows[0];

    if (!artifact) {
      return res.status(404).json({
        error: "Artifact not found.",
        artifactId,
      });
    }

    const dashboardAccessRows = await supabaseRequest(
      `hri_employee_dashboard_access?employee_email=eq.${encodeURIComponent(
        email
      )}&select=access_type,access_value`
    );

    if (!canUserViewArtifact({ employee, artifact, dashboardAccessRows })) {
      return res.status(403).json({
        error: "You do not have access to this artifact.",
        artifactId,
      });
    }

    if (stage === "preview" && !canUserViewPreview({ dashboardAccessRows })) {
      return res.status(403).json({
        error: "Preview access is limited to executive/admin users.",
        artifactId,
      });
    }

    const versionId =
      stage === "preview"
        ? artifact.current_preview_version_id
        : artifact.current_published_version_id;

    if (!versionId) {
      return res.status(404).json({
        error: `No ${stage} version exists for this artifact.`,
        artifactId,
      });
    }

    const versionRows = await supabaseRequest(
      `hri_artifact_versions?version_id=eq.${encodeURIComponent(
        versionId
      )}&select=*`
    );

    const version = versionRows[0];

    if (!version) {
      return res.status(404).json({
        error: "Artifact version not found.",
        artifactId,
        versionId,
      });
    }

    const html = await downloadStorageObject(
      version.storage_bucket,
      version.storage_path_html
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(html);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error.message || "Server error",
    });
  }
};