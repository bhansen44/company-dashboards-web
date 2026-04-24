import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import "./App.css";

const AUTH0_DOMAIN = "dev-r42hmecl0vnw6rr3.us.auth0.com";
const AUTH0_CLIENT_ID = "L0CQAdLtvb5BBXanFhf9lcdpypLMPDpF";

function LoginTest() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    isLoading,
    error,
    user,
  } = useAuth0();

  if (isLoading) {
    return <main style={styles.page}>Loading...</main>;
  }

  return (
    <main style={styles.page}>
      <h1>Auth0 Login Test</h1>

      <p>
        This is a temporary test page. We are using it to confirm exactly what
        your deployed app is sending to Auth0.
      </p>

      <section style={styles.box}>
        <p>
          <strong>Origin:</strong> {window.location.origin}
        </p>
        <p>
          <strong>Auth0 domain:</strong> {AUTH0_DOMAIN}
        </p>
        <p>
          <strong>Auth0 client ID:</strong> {AUTH0_CLIENT_ID}
        </p>
      </section>

      {error && (
        <pre style={styles.error}>
          Auth0 error: {error.message}
        </pre>
      )}

      {!isAuthenticated ? (
        <button style={styles.button} onClick={() => loginWithRedirect()}>
          Sign in with Auth0
        </button>
      ) : (
        <section>
          <p>
            <strong>Logged in successfully.</strong>
          </p>

          <pre style={styles.userBox}>{JSON.stringify(user, null, 2)}</pre>

          <button
            style={styles.button}
            onClick={() =>
              logout({
                logoutParams: {
                  returnTo: window.location.origin,
                },
              })
            }
          >
            Log out
          </button>
        </section>
      )}
    </main>
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
      <LoginTest />
    </Auth0Provider>
  );
}

const styles = {
  page: {
    fontFamily: "Arial, sans-serif",
    padding: "40px",
    maxWidth: "900px",
    margin: "0 auto",
    lineHeight: 1.5,
  },
  box: {
    background: "#f4f4f4",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "16px",
    margin: "20px 0",
  },
  button: {
    fontSize: "16px",
    padding: "12px 18px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    background: "#111827",
    color: "white",
  },
  error: {
    background: "#ffe5e5",
    color: "#7a0000",
    padding: "16px",
    borderRadius: "8px",
    whiteSpace: "pre-wrap",
  },
  userBox: {
    background: "#f4f4f4",
    padding: "16px",
    borderRadius: "8px",
    whiteSpace: "pre-wrap",
  },
};