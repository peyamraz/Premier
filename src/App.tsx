import { Footer, Header, Ticker } from "./components/Chrome";
import { Demos, Multicam } from "./components/Demos";
import { Pricing } from "./components/Pricing";
import { Sections } from "./components/Sections";
import { Workspace } from "./components/Workspace";

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ambient layered glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(620px 420px at 12% -4%, rgba(255,180,60,.075), transparent 62%)," +
            "radial-gradient(700px 500px at 92% 24%, rgba(59,214,176,.05), transparent 60%)," +
            "radial-gradient(640px 480px at 40% 108%, rgba(111,177,255,.05), transparent 62%)",
        }}
      />
      {/* film grain */}
      <div aria-hidden="true" className="noise-layer" />

      <Header />
      <main className="relative z-10">
        <Workspace />
        <div className="mt-16 md:mt-20">
          <Ticker />
        </div>
        <Demos />
        <Multicam />
        <Sections />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
