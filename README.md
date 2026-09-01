# ERP Backend - Setup and Installation Guide

This is the backend server for the ERP system, built with Node.js, TypeScript, Express, and Prisma.

## 🚀 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (or a Supabase instance)
- [Redis](https://redis.io/) (for real-time features and workers)

---

## 🛠️ Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd Backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the `Backend` directory and populate it with the following keys (see `.env.example` if available, or use the list below):
   ```env
   DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
   DIRECT_URL="postgresql://user:password@host:port/dbname?sslmode=require"
   JWT_SECRET="your_jwt_secret"
   REDIS_URL="redis://default:password@host:port"
   
   # AI and Services
   GEMINI_API_KEY="your_gemini_api_key"
   TWILIO_ACCOUNT_SID="your_twilio_sid"
   TWILIO_AUTH_TOKEN="your_twilio_token"
   ```

---

## 🗄️ Database Setup

1. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

2. **Run Migrations** (to setup the schema):
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Seed Initial Data**:
   Populate the database with necessary roles, users, and demo data:
   ```bash
   npx prisma db seed
   ```

---

## 🏃 Starting the Server

### Development Mode
Runs the server with `nodemon` for automatic restarts on file changes:
```bash
npm run dev
```

### Production Mode
Builds the project and starts the production server:
```bash
npm run build
npm start
```

---

## 🏗️ Available Scripts

- `npm run dev`: Start development server.
- `npm run build`: Compile TypeScript to JavaScript.
- `npm start`: Start the compiled server.
- `npm run worker:outbound`: Start the outbound communication worker.
- `npx prisma studio`: Open the Prisma GUI to explore your database.

---

## 🧪 Testing & Diagnostics

- `npm run test:automation`: Run automation engine tests.
- `npm run test:omnichannel`: Run omnichannel hardening tests.
- `node check_db_full.js`: Run a full database connectivity and schema check.

---

## 📝 Troubleshooting

- **Database Connection Failed**: Ensure your `DATABASE_URL` is correct and your database server is reachable.
- **Redis Connection Error**: Ensure Redis is running and the `REDIS_URL` matches your configuration.
- **Prisma Schema Mismatch**: Run `npx prisma generate` after any changes to `schema.prisma`.
