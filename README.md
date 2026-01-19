# Invoice Check - AI-Powered Price Verification Platform

An intelligent platform that automatically verifies prices on supplier receipts and invoices against your agreed price catalogues. Built with Next.js 14, OpenAI GPT-4 Vision, and Prisma.

## Features

- **AI-Powered Document Processing**: Upload PDFs, images, Excel files, or Word documents - the AI extracts all product prices automatically
- **Multilingual Support**: Full Turkish language support - product names stay in their original language
- **Smart Product Matching**: Intelligent matching handles abbreviations, spelling variations, and different formats
- **Price Comparison Reports**: Instant identification of overcharges and discrepancies
- **Secure & Private**: User-isolated data with encrypted storage

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: NextAuth.js v5
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **AI**: OpenAI GPT-4 Vision + GPT-4 Turbo
- **File Storage**: Vercel Blob
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (recommend [Neon](https://neon.tech))
- OpenAI API key
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
   
   # OpenAI API
   OPENAI_API_KEY="sk-your-openai-api-key"
   
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
│   └── openai.ts         # OpenAI client
├── services/             # Business logic services
│   ├── ai/              # AI extraction services
│   ├── file/            # File processing
│   ├── comparison/      # Price comparison
│   └── reports/         # Report generation
└── types/               # TypeScript types
```

## Usage

### 1. Upload Price Catalogue

Upload your supplier's price catalogue (PDF, Excel, CSV, Word, or images). The AI extracts all products with their prices while preserving the original language.

### 2. Upload Receipt/Invoice

Upload receipts or invoices from your suppliers. The AI reads every line item and extracts quantities, prices, and totals.

### 3. Verify Prices

Select a catalogue to compare against and run the verification. The system matches products intelligently (even with name variations) and generates a detailed report.

### 4. Review Report

See overcharges and discrepancies highlighted. Export reports to CSV for supplier disputes.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/catalogues` | GET, POST | List/create catalogues |
| `/api/catalogues/[id]` | GET, PUT, DELETE | Manage catalogue |
| `/api/catalogues/[id]/items` | GET, POST, PUT, DELETE | Manage items |
| `/api/receipts` | GET, POST | List/create receipts |
| `/api/receipts/[id]` | GET, DELETE | Manage receipt |
| `/api/receipts/[id]/verify` | POST | Run price verification |
| `/api/reports` | GET | List reports |
| `/api/reports/[id]` | GET, DELETE | View/delete report |
| `/api/dashboard` | GET | Dashboard statistics |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js session encryption |
| `NEXTAUTH_URL` | Base URL of your application |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 Vision |
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
