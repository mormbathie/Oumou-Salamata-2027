import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'oumou-salamat',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'oumou-salamat-app',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
