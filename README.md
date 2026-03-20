# DentaPass

DentaPass is a digital wallet loyalty card platform for dental clinics. Patients scan a QR code and get a branded card in their Apple or Google Wallet. The card handles recall reminders, Google review requests, referral programs, and loyalty points — all automated.

## Repository Structure

| Folder | Description |
|--------|-------------|
| [`/backend`](./backend) | Next.js API routes, Supabase integration, PassKit wallet pass generation, Vercel Cron jobs for automated recall reminders and review requests |
| [`/website`](./website) | Next.js landing page and patient enrollment flow hosted on Vercel |
| [`/mobile`](./mobile) | React Native + Expo app for dental clinic owners to manage patients, scan QR codes, and send notifications |