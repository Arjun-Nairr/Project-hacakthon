import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MoneyShell } from '@/components/money-shell';
import HomePage from '@/pages/home';
import LoanPage from '@/pages/loan';
import MoneyCalendarPage from '@/pages/money-calendar';
import GoalsPage from '@/pages/goals';
import CalendarPage from '@/pages/calendar';
import ChatPage from '@/pages/chat';
import OnboardingPage from '@/pages/onboarding';
import NotFound from '@/pages/not-found';
import ImportHub from '@/components/import-hub';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <MoneyShell>
        <Switch>
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/" component={MoneyCalendarPage} />
          <Route path="/loan" component={LoanPage} />
          <Route path="/home" component={HomePage} />
          <Route path="/goals" component={GoalsPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/imports" component={ImportHub} />
          <Route component={NotFound} />
        </Switch>
      </MoneyShell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
