import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { SoundProvider } from './audio/SoundProvider';
import './App.css';

function App() {
  return (
    <SoundProvider>
      <AppLayout>
        <HomePage />
      </AppLayout>
    </SoundProvider>
  );
}

export default App;
