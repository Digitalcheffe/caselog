import { useState } from 'react';
import { apiKeyStorage } from '../api/client';
import { RouteState } from '../components/RouteState';

export const SettingsPage = () => {
  const [apiKey, setApiKey] = useState(apiKeyStorage.get() ?? '');

  const saveApiKey = () => {
    if (apiKey.trim().length === 0) {
      apiKeyStorage.clear();
      return;
    }

    apiKeyStorage.set(apiKey.trim());
  };

  return (
    <RouteState title="Settings" description="API keys, profile, 2FA, and SMTP configuration.">
      <div className="settings-row">
        <label htmlFor="api-key" className="sidebar-title">API Key</label>
        <input
          id="api-key"
          className="settings-input"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="Paste Bearer API key"
        />
        <button type="button" onClick={saveApiKey} className="theme-toggle">
          Save key
        </button>
      </div>
    </RouteState>
  );
};
