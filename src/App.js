import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import ModernPlantScanner from './ModernPlantScanner';

function App() {
  return (
    <div className="App">
      <ModernPlantScanner />
      <Analytics />
    </div>
  );
}

export default App;
