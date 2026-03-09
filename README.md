# IaC-1 Web App

## Description

Web app for the IaC-1 project.

## Installation

```bash
$ npm install
```

## Running the app

### Development environment

**Run the app in development mode**
```bash
npm run start
```

**Or with watch mode**
```bash
npm run start:dev
```

### Production environment

```bash
npm run build
npm run start:prod
```

## Environment Variables

Files to store environment variables in:
* `.env`
* `.env.local`

### App
* **PORT** = port to run the app on
* **NODE_ENV** = environment to run the app in (if not "production", database can be erased)

### Database
* **MYSQL_HOST** = hostname of the database
* **MYSQL_PORT** = port of the database
* **MYSQL_USER** = username of the database
* **MYSQL_PASSWORD** = password of the database
* **MYSQL_DATABASE** = name of the database
* **DB_INIT_SYNC** = to sync the database on startup (if "true", database can be erased) (value : "true" or "false")

### Logs

* **LOG_LEVEL** = Log level logged by logger
(Possibilities in order of importance : `error`,`warn`,`info`,`http`,`verbose`,`debug` ou `silly`)
(See **Winston** log levels: https://www.npmjs.com/package/winston#logging-levels)
(Default: `verbose`)

* **LOG_DIRECTORY** = Folder where log files will be written (by default, logs are written in the current directory in `logs`)

### Tests E2E

* **TEST_AUTO_RUN_SERVER** = to run the server automatically before running the tests (value : "true" or "false")
* **TEST_HOST** = hostname of the app to test (default: "http://localhost:3000")
* **TEST_USERNAME** = username to use on the app to test (default: "toto")

## Test

### Unit tests

Unit tests are written with **Jest** and can be run without application running or application environment (database, ...).

**Command to run unit tests**
```bash
npm run test
```

**Command to run unit tests with watch mode**
```bash
npm run test:watch
```

### E2E tests

E2E tests are written with **Playwright** and can't be run without application running or application environment (database, ...).

**Command to run headless E2E tests**
```bash
npm run test:e2e
```

**Command to run E2E tests with browser**
```bash
npm run test:e2e:ui
```


## Stack
* Node.js
* TypeScript
* Express.js
* Nest
* Jest
* Playwright