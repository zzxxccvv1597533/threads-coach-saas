import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import IpProfile from "./pages/IpProfile";
import WritingStudio from "./pages/WritingStudio";
import Optimize from "./pages/Optimize";
import Tasks from "./pages/Tasks";
import Drafts from "./pages/Drafts";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/ip-profile"} component={IpProfile} />
      <Route path={"/writing-studio"} component={WritingStudio} />
      <Route path={"/optimize"} component={Optimize} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/drafts"} component={Drafts} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
