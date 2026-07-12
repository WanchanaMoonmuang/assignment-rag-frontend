import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type FormEvent, useRef, useState } from "react";

import { ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";

export function LoginView() {
  const { login, sessionMessage, clearSessionMessage } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    clearSessionMessage();
    if (!username.trim()) {
      setError("Enter both your username and password.");
      usernameInputRef.current?.focus();
      return;
    }
    if (!password) {
      setError("Enter both your username and password.");
      passwordInputRef.current?.focus();
      return;
    }
    setPending(true);
    try {
      await login(username.trim(), password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        p: { xs: 4, sm: 8 },
        backgroundColor: "background.default",
      }}
    >
      <Paper
        component="section"
        variant="outlined"
        sx={{ width: "100%", maxWidth: 420, p: { xs: 6, sm: 8 }, boxShadow: "0 12px 36px rgba(24,33,47,0.08)" }}
      >
        <Stack spacing={6}>
          <Stack spacing={3}>
            <Box
              sx={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: "primary.main", color: "primary.contrastText" }}
            >
              <AutoAwesomeRounded aria-hidden="true" />
            </Box>
            <Typography component="h1" variant="h2">Knowledge Assistant</Typography>
            <Typography color="text.secondary">Sign in to your workspace</Typography>
          </Stack>

          {sessionMessage ? <Alert severity="warning">{sessionMessage}</Alert> : null}
          {error ? <Alert severity="error" role="alert">{error}</Alert> : null}

          <Stack component="form" spacing={4} onSubmit={(event) => { void handleSubmit(event); }} noValidate>
            <TextField
              id="username"
              label="Username"
              autoComplete="username"
              autoFocus
              required
              inputRef={usernameInputRef}
              value={username}
              disabled={pending}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              id="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              inputRef={passwordInputRef}
              value={password}
              disabled={pending}
              onChange={(event) => setPassword(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start"><LockOutlined fontSize="small" aria-hidden="true" /></InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showPassword ? "Hide password" : "Show password"}>
                        <IconButton
                          edge="end"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="contained" size="large" loading={pending} fullWidth>
              Sign in
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
