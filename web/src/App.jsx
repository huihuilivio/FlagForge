import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FeatureList from './pages/FeatureList';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FeatureList />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
