# Enterprise PDF-to-CSV Processor

A comprehensive Next.js 14 application for converting PDF documents to structured CSV files with enterprise-grade security and customer-specific processing rules.

## 🚀 Features

### Core Functionality
- **PDF Processing**: Advanced OCR with fallback for scanned documents
- **Customer Detection**: Automatic identification using pattern matching
- **Template Engine**: Configurable extraction rules per customer
- **Hardcoded Mapping**: Transform values (e.g., "freight" → "SHIPPING_COST")
- **CSV Generation**: Structured output with validation
- **Reprocessing**: Version control and change tracking
- **Archive Management**: Document lifecycle management

### Security & Access Control
- **Role-Based Access**: Admin, Manager, User, Read-only roles
- **Authentication**: Secure password-based auth with account lockout
- **Audit Logging**: Complete activity tracking
- **Rate Limiting**: API protection with Redis
- **Security Headers**: CSP, XSS protection, and more
- **Data Validation**: Server-side input sanitization

### Enterprise Features
- **Multi-tenant**: Customer-specific processing rules
- **Background Processing**: Async job orchestration
- **Error Handling**: Comprehensive error recovery
- **Email Notifications**: Processing status updates
- **Performance Monitoring**: Built-in analytics
- **Responsive Design**: Mobile-first UI

## 🛠 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS + shadcn/ui
- **PDF Processing**: PDF.js + Tesseract.js OCR
- **File Storage**: Vercel Blob Storage
- **Rate Limiting**: Upstash Redis
- **Email**: SendGrid
- **Deployment**: Vercel

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (or SQLite for local development)
- Required API keys (see environment setup)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/hsivananthan/pdf-processor.git
   cd pdf-processor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:3001
   ```

### Default Login Credentials
- **Admin**: admin@pdf-processor.com / AdminPassword123!
- **Manager**: manager@pdf-processor.com / ManagerPassword123!
- **User**: user@pdf-processor.com / UserPassword123!

## 🚀 Production Deployment

### Vercel Deployment

1. **Connect GitHub Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Import GitHub repository: https://github.com/hsivananthan/pdf-processor.git
   - Configure environment variables

2. **Required Environment Variables**
   ```bash
   DATABASE_URL=postgresql://user:password@host/dbname
   NEXTAUTH_SECRET=your-production-secret
   NEXTAUTH_URL=https://your-app.vercel.app
   SENDGRID_API_KEY=your-sendgrid-key
   UPSTASH_REDIS_REST_URL=your-redis-url
   UPSTASH_REDIS_REST_TOKEN=your-redis-token
   ```

3. **Set up Production Services**

   **Database (Neon PostgreSQL)**
   - Sign up at [Neon.tech](https://neon.tech/)
   - Create a new database
   - Copy connection string to `DATABASE_URL`

   **Email (SendGrid)**
   - Sign up at [SendGrid](https://sendgrid.com/)
   - Create API key
   - Set `SENDGRID_API_KEY`

   **Rate Limiting (Upstash Redis)**
   - Sign up at [Upstash](https://upstash.com/)
   - Create Redis database
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

4. **Deploy**
   - Push to main branch
   - Vercel will automatically deploy
   - Run database migrations in Vercel dashboard

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main application
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── lib/                  # Core business logic
│   ├── auth.ts           # Authentication config
│   ├── pdf-processor.ts  # PDF processing engine
│   ├── customer-detector.ts # Customer detection
│   ├── template-engine.ts   # Template processing
│   └── utils.ts          # Utilities
└── types/                # TypeScript definitions
```

## 🔧 Configuration

### Customer Detection Patterns
Configure customer identification in the admin panel:
- **Text patterns**: Search for specific strings
- **Regex patterns**: Advanced pattern matching
- **Position-based**: Text at specific coordinates
- **Filename patterns**: Detection from file names

### Template Configuration
Set up extraction rules for each customer:
- **Field definitions**: Define data types and validation
- **Extraction zones**: Specify document areas
- **Hardcoded mappings**: Value transformations
- **Priority rules**: Handle conflicts

## 🔒 Security Features

- **Authentication**: Secure password hashing with bcrypt
- **Authorization**: Role-based access control (RBAC)
- **Session Management**: JWT with secure cookies
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Server-side sanitization
- **Audit Logging**: Complete activity tracking
- **Security Headers**: XSS, CSRF, and clickjacking protection
- **File Upload Security**: Type and size validation

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run build
npm run build
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `GET /api/auth/session` - Get current session

### Document Processing
- `POST /api/upload` - Upload PDF document
- `GET /api/documents` - List documents
- `POST /api/process/:id` - Reprocess document
- `GET /api/download/:id` - Download CSV output

### Administration
- `GET /api/users` - List users (Admin only)
- `POST /api/users` - Create user (Admin only)
- `GET /api/audit` - Audit logs (Admin only)
- `GET /api/customers` - List customers
- `POST /api/templates` - Create template

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify `DATABASE_URL` is correct
- Check network connectivity
- Ensure database is running

**PDF Processing Failures**
- Check file size limits (`MAX_FILE_SIZE`)
- Verify file is a valid PDF
- Check processing timeout settings

**Authentication Issues**
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches deployment URL
- Clear browser cookies and try again

### Debug Mode
Set `NODE_ENV=development` for detailed error messages and debug information.

## 📄 License

This project is proprietary software. All rights reserved.

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.
