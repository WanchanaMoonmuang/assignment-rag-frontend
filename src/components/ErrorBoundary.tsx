import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Application render failed", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 4 }}>
        <Stack spacing={4} sx={{ width: "100%", maxWidth: 480 }}>
          <Typography component="h1" variant="h2">Knowledge Assistant</Typography>
          <Alert severity="error">The application could not be displayed.</Alert>
          <Button startIcon={<RefreshRounded />} onClick={() => window.location.reload()}>
            Reload application
          </Button>
        </Stack>
      </Box>
    );
  }
}
