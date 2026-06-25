import { useContext } from "react";
import { AppProviders } from "./app/providers";
import { AppRoutes } from "./app/routes";
import { useAppBootstrap } from "./app/use-app-bootstrap";
import { BlurredBubbles } from "./components/blurred-bubbles";
import { ClientConfigContext } from "./state/config";

// Default bubble palette aligned with 2025-blog
const DEFAULT_BUBBLE_COLORS = ["#a8d8ea", "#aa96da", "#fcbad3", "#ffffd2"];

function AppBackground() {
  const config = useContext(ClientConfigContext);
  const enabled = Boolean(config.get("background.bubbles"));
  if (!enabled) return null;
  const colors = (config.get("background.bubbles.colors") as string[] | undefined) ?? DEFAULT_BUBBLE_COLORS;
  return (
    <BlurredBubbles
      count={6}
      colors={colors}
      minRadius={250}
      maxRadius={400}
      bottomBandStart={0}
      speed={0.12}
      noiseScale={0.0008}
      noiseTimeScale={0.00015}
      targetFps={6}
      startDelayMs={1500}
    />
  );
}

function App() {
  const { config, profile } = useAppBootstrap();

  return (
    <AppProviders config={config} profile={profile}>
      <div className="relative flex min-h-screen flex-col bg-bg">
        <AppBackground />
        <div className="relative z-10 flex flex-1 flex-col">
          <AppRoutes />
        </div>
      </div>
    </AppProviders>
  )
}

export default App
