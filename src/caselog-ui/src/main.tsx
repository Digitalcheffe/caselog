import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const App = () => {
  return (
    <main>
      <h1>Caselog</h1>
      <p>Project scaffold is running.</p>
    </main>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
