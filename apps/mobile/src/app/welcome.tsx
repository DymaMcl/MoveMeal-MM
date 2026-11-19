import { WelcomeView } from '@/components/welcome-view';

/** Ecranul de bun venit fara animatia de deschidere (de exemplu dupa iesirea din cont). */
export default function Welcome() {
  return <WelcomeView stage="welcome" animated={false} />;
}
