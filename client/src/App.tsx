import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";
import { useAppBootstrap } from "./app/use-app-bootstrap";
import { BackTop, ScrollProgress } from "./components/mirages-chrome";

function App() {
  const { config, profile } = useAppBootstrap();

  return (
    <AppProviders config={config} profile={profile}>
      <ScrollProgress />
      <BackTop />
      <AppRoutes />
    </AppProviders>
  )
}

export default App
