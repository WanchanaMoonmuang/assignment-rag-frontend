import { Alert, Button, Stack, Typography } from "@mui/material";

import { useAuth } from "./auth/AuthContext";
import { ChatWorkspace } from "./chat/ChatWorkspace";
import { AppLoader } from "./components/AppLoader";
import { LoginView } from "./features/auth/LoginView";

export function App() {
  const { status, sessionMessage, retrySession, logout } = useAuth();
  if (status === "checking") return <AppLoader />;
  if (status === "unauthenticated") return <LoginView />;
  if (status === "unavailable") {
    return <Stack component="main" spacing={4} sx={{ minHeight: "100dvh", maxWidth: 480, mx: "auto", px: 4, justifyContent: "center" }}><Typography component="h1" variant="h2">Session unavailable</Typography><Alert severity="warning">{sessionMessage}</Alert><Stack direction="row" spacing={3}><Button variant="contained" onClick={retrySession}>Retry session</Button><Button onClick={logout}>Sign out</Button></Stack></Stack>;
  }
  return <ChatWorkspace />;
}
