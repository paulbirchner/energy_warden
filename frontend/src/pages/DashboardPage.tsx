import { BackendStatus } from "../components/BackendStatus";
import { CurrentPriceCard } from "../components/CurrentPriceCard";
import { PriceList } from "../components/PriceList";
import { SuggestionList } from "../components/SuggestionList";

export default function App() {
  return (
    <main>
      <h1>Energy Warden</h1>

      <BackendStatus />
      <CurrentPriceCard />
      <SuggestionList />
      <PriceList />
    </main>
  );
}