import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import { AppBar, Avatar, Box, Button, Divider, IconButton, Stack, Toolbar, Typography, useMediaQuery } from "@mui/material";
import type { PropsWithChildren, ReactNode } from "react";

import { useAuth } from "../auth/AuthContext";

export function WorkspaceShell({ children, sidebar, title = "New conversation", onOpenConversations, toolbarAction }: PropsWithChildren<{ sidebar?: ReactNode; title?: string; onOpenConversations?: () => void; toolbarAction?: ReactNode }>) {
  const { username, logout } = useAuth();
  const showSidebar = useMediaQuery("(min-width: 1024px)");
  const sidebarWidth = useMediaQuery("(min-width: 1440px)") ? 304 : 280;
  return <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: "background.default" }}>
    <Box component="aside" sx={{ width: sidebarWidth, flexShrink: 0, display: showSidebar ? "flex" : "none", flexDirection: "column", borderRight: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Stack direction="row" spacing={3} sx={{ height: 64, px: 5, alignItems: "center" }}><Avatar variant="rounded" sx={{ width: 32, height: 32, bgcolor: "primary.main" }}><AutoAwesomeRounded fontSize="small" aria-hidden="true" /></Avatar><Typography variant="h3">Knowledge Assistant</Typography></Stack>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0 }}>{sidebar}</Box>
    </Box>
    <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}><Toolbar sx={{ minHeight: "64px !important", gap: 4 }}>
        <IconButton aria-label="Open conversations" onClick={onOpenConversations} sx={{ display: showSidebar ? "none" : "inline-flex" }}><MenuRounded /></IconButton>
        <Typography variant="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>{title}</Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>{toolbarAction}<PersonOutlineRounded color="action" aria-hidden="true" /><Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>{username}</Typography><Button color="inherit" startIcon={<LogoutRounded />} onClick={logout}>Logout</Button></Stack>
      </Toolbar></AppBar>
      <Box component="main" sx={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", p: { xs: 0, sm: 0 } }}>{children}</Box>
    </Box>
  </Box>;
}
