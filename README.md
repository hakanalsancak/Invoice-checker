# Invoice Check - Price Verification Platform

A platform that verifies prices on supplier invoices against your agreed price catalogues. Built with Next.js 14 and Prisma.

## Features

- **Manual Data Entry**: Create catalogues and invoices with a clean interface
- **Multilingual Support**: Full Turkish language support - product names stay in their original language
- **Price Comparison Reports**: Instant identification of overcharges and discrepancies
- **Currency Conversion**: Automatic conversion when invoice and catalogue use different currencies
- **Secure & Private**: User-isolated data with encrypted storage

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js v5
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (recommend [Neon](https://neon.tech))
- Vercel account (for Blob storage)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd invoice-check
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   # Database (Neon PostgreSQL)
   DATABASE_URL="postgresql://username:password@host.neon.tech/database?sslmode=require"
   
   # NextAuth.js
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Vercel Blob Storage
   BLOB_READ_WRITE_TOKEN="vercel_blob_your_token_here"
   ```

4. Set up the database:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   └── shared/           # Shared components
├── lib/                   # Utilities and configurations
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   └── currency.ts       # Currency utilities
├── services/             # Business logic services
│   ├── comparison/      # Price comparison
│   └── reports/         # Report generation
└── types/               # TypeScript types
```

## Usage

### 1. Create Price Catalogue

Create your supplier's price catalogue by adding products with their prices manually.

### 2. Create Invoice

Create invoices from your suppliers. Select products from your linked catalogues and enter the invoice prices.

### 3. Verify Prices

Select a catalogue to compare against and run the verification. The system compares prices and generates a detailed report.

### 4. Review Report

See overcharges and discrepancies highlighted. Export reports to PDF or CSV.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/catalogues` | GET, POST | List/create catalogues |
| `/api/catalogues/[id]` | GET, PUT, DELETE | Manage catalogue |
| `/api/catalogues/[id]/items` | GET, POST, PUT, DELETE | Manage items |
| `/api/invoices` | GET, POST | List/create invoices |
| `/api/invoices/[id]` | GET, DELETE | Manage invoice |
| `/api/invoices/[id]/verify` | POST | Run price verification |
| `/api/reports` | GET | List reports |
| `/api/reports/[id]` | GET, DELETE | View/delete report |
| `/api/dashboard` | GET | Dashboard statistics |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js session encryption |
| `NEXTAUTH_URL` | Base URL of your application |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- AWS Amplify
- Railway
- Render
- Self-hosted with Docker

## License

MIT License - See LICENSE file for details.

## Support

For support, please open an issue on GitHub.
