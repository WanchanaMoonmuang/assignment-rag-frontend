import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

export function AppLoader() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 4 }}>
      <Stack spacing={4} role="status" aria-live="polite" sx={{ alignItems: "center" }}>
        <AutoAwesomeRounded color="primary" sx={{ fontSize: 32 }} aria-hidden="true" />
        <CircularProgress size={28} thickness={4} />
        <Typography color="text.secondary">Restoring your session</Typography>
      </Stack>
    </Box>
  );
}
