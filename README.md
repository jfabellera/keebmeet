# KeebMeet

A way to manage large-scale meetups for Tex Mechs.

## Project Details

This project is split into two portions:

- The backend that sets up a REST API to query the database (PostgreSQL by default)
- The frontend React application with the UI to interact with the data

## Setup

### Database

1. Install [PostgreSQL](https://www.postgresql.org/download/) and create a user and database that the user has access to.

2. Install [Liquibase](https://www.liquibase.com/download#download-liquibase). This will be used for version control of the database schema.

3. Create a file named `liquibase.properties` in `db/changelog` with the following:

   ```text
   driver: org.postgresql.Driver
   url: jdbc:postgresql://localhost:5432/<database name>
   username: <database username>
   password: <database password>
   changeLogFile: changelog.sql
   ```

4. Setup the database schema using Liquibase by running the following:

   ```bash
   cd db/changelog
   liquibase update
   ```

### Backend

1. Install dependencies.

   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` file in `backend/` in the following format (Ports may change depending on database used/personal preference):

   ```bash
   KEEBMEET_API_SERVER_HOSTNAME=localhost
   KEEBMEET_API_SERVER_PORT=3000
   KEEBMEET_AUTH_SERVER_HOSTNAME=localhost
   KEEBMEET_AUTH_SERVER_PORT=3001
   KEEBMEET_SOCKET_SERVER_HOSTNAME=localhost
   KEEBMEET_SOCKET_SERVER_PORT=3002

   KEEBMEET_API_URL=http://localhost:3000
   KEEBMEET_SOCKET_URL=http://localhost:3002

   KEEBMEET_DATABASE_HOST=localhost
   KEEBMEET_DATABASE_PORT=5432
   KEEBMEET_DATABASE_NAME=
   KEEBMEET_DATABASE_USER=
   KEEBMEET_DATABASE_PASSWORD=

   JWT_ACCESS_SECRET=
   AES_ENCRYPTION_KEY=

   GCP_API_KEY=
   EVENTBRITE_API_KEY=
   EVENTBRITE_CLIENT_SECRET=
   ```

3. Start the authentication server.

   ```bash
   npm run devAuth
   ```

4. Start the API server.

   ```bash
   npm run dev
   ```

### Frontend

1. Install dependencies.

   ```bash
   cd frontend
   npm install
   ```

2. Create a `.env` file in `frontend/` in the following format (Variables may change depending on port used/personal preference):
   **Make sure your API URL matches the API Server URL and port you specified in your backend .env file above.**

   ```bash
   VITE_KEEBMEET_API_SERVER_URL=http://localhost:3000
   VITE_KEEBMEET_AUTH_SERVER_URL=http://localhost:3001
   VITE_KEEBMEET_SOCKET_SERVER_URL=http://localhost:3002
   VITE_KEEBMEET_APP_URL=http://localhost:5173
   ```

3. Run the app.

   ```bash
   npm run [dev|prod]
   ```
