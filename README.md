# Medici

Medici is a minimalistic, self-hostable alternative to Splitwise for managing group expenses. Named after the Florentine [House of Medici](https://en.wikipedia.org/wiki/House_of_Medici), it focuses on simplicity and privacy while providing all the essential features you need.

## Why Medici?

- **Privacy-first**: Self-host your financial data instead of trusting third parties
- **Minimalistic**: Clean, distraction-free interface with only essential features
- **Easy deployment**: Single Docker Compose command to get started
- **No subscriptions**: Own your data, no recurring fees
- **Open Source**: Fully transparent codebase, no hidden agendas
- **No tracking**: No ads, analytics, or data collection
- **No limits**: Unlimited pools, friends, and expenses without hidden fees

## Features

### Core Functionality

1. **Pools**: Create groups ("pools") to organize expenses by context (roommates, trips, etc.)
2. **Friend Management**: Add friends and organize them into relevant pools
3. **Smart Splitting**:
   - Set default split percentages per pool for quick expense entry
   - Split expenses evenly or with custom percentages
   - Automatic debt simplification to minimize transactions
4. **Expense Tracking**:
   - Categorize expenses for better organization
   - Add detailed descriptions and notes
   - Track who paid and who owes what

### Analytics & Insights

5. **Spending Analytics**: View top spending categories
6. **Debt Overview**: See who owes you money and how much you owe others at a glance
7. **Payment Integration**: Add Venmo handles for easy payment requests and settlements

### Privacy & Control

8. **Self-hosted**: Keep your financial data on your own infrastructure
9. **Open Source**: Full transparency and customizability
10. **No tracking**: No analytics, ads, or data collection

## Screenshots

### View Pools

|             Friends View              |                   Profile View                    |
| :-----------------------------------: | :-----------------------------------------------: |
| ![](./screenshots/pools-overview.png) | ![](./screenshots/pools-overview-profile-tab.png) |

### Pool Details

|            Roommates             |            Yosemite Trip             |
| :------------------------------: | :----------------------------------: |
| ![](./screenshots/roommates.png) | ![](./screenshots/yosemite-trip.png) |

### Add Expenses

![Add Expenses](./screenshots/add-expense.png)

## Quick Start

### Docker Compose (Recommended for Self-Hosting)

The easiest way to get Medici running in production is to run the `compose.example.yaml` file, which will pull the necessary Docker images. You'll need a `.env` for the backend like this:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5442/medici
AUTH_SECRET_KEY=medici-key
```

and for the frontend like this:

```
VITE_API_URL=http://medici-server:8000
```

### Local Development Setup

For development or if you prefer running without Docker:

**Prerequisites:**

- [Rust](https://rustup.rs/) (latest stable version)
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) package manager
- [PostgreSQL](https://postgresql.org/) (v12 or higher)
- [just](https://github.com/casey/just) command runner
- [diesel_cli](https://diesel.rs/guides/getting-started) for database migrations

**Detailed Setup Steps:**

1. **Install Prerequisites:**

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install diesel CLI
cargo install diesel_cli --no-default-features --features postgres

# Install just
cargo install just

# Install Node.js and pnpm (using your preferred method)
# On macOS with Homebrew:
brew install node pnpm
```

2. **Database Setup:**

```bash
# Start PostgreSQL (method varies by OS)
# On macOS with Homebrew:
brew services start postgresql

# Create database and user
psql postgres -c "CREATE DATABASE medici;"
psql postgres -c "CREATE USER medici WITH PASSWORD 'medici';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE medici TO medici;"
```

3. **Clone and Configure:**

```bash
# Clone the repository
git clone https://github.com/your-username/medici.git
cd medici

# Set up environment files
just set-env-backend
just set-env-frontend

# Review and edit .env files as needed
cat server/.env
cat frontend/.env
```

4. **Initialize and Start:**

```bash
# Run the complete setup (installs dependencies, runs migrations)
just setup

# Start development servers in separate terminals:

# Terminal 1: Frontend (React dev server)
cd frontend && pnpm dev

# Terminal 2: Backend (Rust server with hot reload)
cd server && cargo watch -x run
```

The development setup will be available at:

- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
