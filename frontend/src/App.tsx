import { TTSPage } from './components/pages/TTSPage';
import { Layout } from './components/layout';

function App() {
  return (
    <Layout>
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-primary-700">Text-to-Speech Conversion</h2>
          <p className="mt-2 text-gray-600">
            Convert text to speech using various models and voices
          </p>
        </div>
        <TTSPage />
      </div>
    </Layout>
  );
}

export default App;